This note details the management of the message tangle.
Started 2 June 2020.


# Summary

Data will be gossiped through the network in objects called messages. These messages will be stored in a data structure called the  message tangle.   This specification details how this information is stored and managed.  

The exact layout of messages is given in a [different specification](add-link).  Moreover, how messages are gossiped is the subject of the [rate control specification](add-link).  

In this specification, we discuss the following topics.
1. Timestamps
2. Below Max Depth Rule
3. Tip selection
4. Finality
5. Snapshotting
6. Reattachments

Each of these topics will be given a "mini-specification" which details the design along with the rationale and any open questions or alternatives.




# Preliminaries


## Parameters, lists, and functions
The following are the applicable parameters.  
* `D` gGratuitous network delay~5 minutes.  We assume all messages are delivered within this time.
* `w` window~30 minutes. Require `w>2D`
* `Delta` max difference in consecutive timestamps. Require `Delta>w+D`
* `theta` confidence level of grade 2 finality for messages.  
* `T` time for grade 3 finality for messages
* `snapshotTime` Age of a transaction when snapshotted. Require `snapshotTime>Delta+w+2D`  


The following are the applicable lists.
* `messageTangle` The database of messages.
*  `eligibleTipsList` The messages eligible for the selection algorithm.  
* `pending` The messages not eligible for tip selection.  

In implementations, the second two lists could simply be flags on messages in `messageTangle`.   

We use the following variable
* `currentTime` which gives the current time of the node.  



We define the following function.
* `getTip` Function which employs the tip selection algorithm.
* `confirmationConfidence` Measures the number of approvers.


## How messages are stored

Every message in `messageTangle` will be identified through its `MessageID`.  Each message contains the following information ~~which is relevant to this specification~~:
* `parent1` and `parent2` These are message IDs of two other messages and endow the message tangle with a DAG structure.  Together these fields shall be called *parents*.
* `timeStamp` This is a time.  This field will be discussed in SubsSection 1. 

Messages of course have other information, but they are not relevant for this specification.  See [BLANK](https://) for a full account on the layouts of messages.

Messages will be stored with the following fields:
* `arrivalTime` The time that the message first arrived to the node.  
* `opinionField` Contains the nodes' opinion on the timestamp of a message.  As specified [here](https://hackmd.io/xBfQ04NkRi6IrwhEQm7aJQ), this field is a triple `(opinion,level,timeFormed)`, where `opinion` is a Boolean value, `level` is in the set {1,2,3}, and `timeFormed` is a time. The `opinionField` is also manipulated by FPC.
* `eligible` is a Boolean value, denoting if the message was ever eligible for tip selection. 

# Main Components

## 1. Timestamps
 

Every message contains the field `timeStamp` which is signed.  The timestamp should be the time when the message was created, and this will be enforced to some degree through voting.  Specifically, nodes will vote on whether the timestamp was issued within `w` of current time. This time window is large to account for the network delay. 

### Detailed Design
When a message is being added to the tangle, the following algorithm will be performed:
```
timeFormed <- currentTime
If |arrivalTime-currenTime|<w 
    Then opinion <- TRUE
    Else opinion <- FALSE
If ||arrivalTime-currenTime|-w|<D 
    Then level <- 1
Else If ||arrivalTime-currenTime|-w|<2D
    Then level <- 2
Else level <- 3
```  

### Rationale
Since $D$ estimates the network delay, a node can reasonably estimate the arrival time of messages to other nodes.  A node has level 2 knowledge if the time difference is greater than the network delay. A node has level 3 knowledge if the difference is greater than twice the network delay.  See [this specification](https://hackmd.io/xBfQ04NkRi6IrwhEQm7aJQ) for a deeper discussion on levels of knowledge.  

### Open Questions

The main question is how large to set `w` and `D`.  A small `w` would enable many applications, since the timestamps would be more accurate.  However, they cannot be too small without causing problems with network delays.  


## 2. Below Max Depth Check 

We need the tangle to grow forward: we do not want incoming messages to reference extremely old messages.  If any new message can reference any message in the tangle, then a node will need to keep all messages readily available in memory, precluding snapshotting.  

### Detailed Design

When a message is added to the tangle, the node runs the following *Below Max Depth Check*.

```
If { Delta>messageID.timestamp-messageID.parent1.timeStamp >0} is FALSE
    Then Return INVALID
If { Delta>messageID.timestamp-messageID.parent2.timeStamp >0} is FALSE
    Then Return INVALID
```

If this check returns `INVALID`, the message is considered invalid and is deleted.  

### Rationale

Suppose an incoming message has a parent with timestamp older than w+2D+Delta.  Then the message either has a timestamp which is bad level 3, or else it will fail the below max depth check.  In either case, the message will eventually be deleted. 

## 3. Tips selection

We will use RURTS which stands for Restricted Uniform Random Tip Selection. This means we choose tips randomly from  a list of "good" tips, i.e., the `eligibleTipsList`.  


### Detailed Design


First, we describe how the `eligibleTipsList` is maintained.  After the timestamp is set, when a message is added to the tangle, the following logic is performed:
```
If messageID.opinionField.opinion=TRUE and (messageID.opinionField.level=2 or messageID.opinionField.level=3) 
Then 
    If messageID.parent1.eligible=True and messageID.parent2.eligible=True
        Then 
        messageID.eligible<-True
        Add messageID to eligibleTipsList
        Remove messageID.parent1 from eligibleTipsList
        Remove messageID.parent2 from eligibleTipsList
    EndIf
Else Add MessageID to pending
Endif
```

Periodically we check the `pending` list for new messages which are eligible.  
```
For every messageID in pending
    If messageID.opinionField.opinion=TRUE and (MessageID.opinionField.level=2 or messageID.opinionField.level=3) 
    Then 
        If MessageID.parent1.eligible=True and MessageID.parent2.eligible=True
            Then 
            Remove MessageID from pending
            MessageID.eligible<-True
            Add MessageID to eligibleTipsList
            Remove MessageID.parent1 from eligibleTipsList
            Remove MessageID.parent2 from eligibleTipsList
        EndIf
    EndIf
EndFor
```


We now define the following function `getTip`.
```
Function: getTip
Inputs: none
Outputs: messageID

While (currentTime-messageId.timeStamp<Delta) is FALSE
    Randomly select messageID from eligibleTipsList
EndWhile
Return messageID
```


### Rationale

RURTS is easy to implement, computationally inexpensive, and minimiszes orphanage. Moreover, it is in weak Nash equilibrium: honest users have nothing to gain by deviating from the protocol. Moreover, this tip selection algorithm should be resistant to blow ball attacks.  

As demonstrated in the original Iota white paper and subsequent simulations, URTS has no orphans.  Theoretically, RURTS should largely approximate URTS.  The only difference is that some tips may "expire" when they become older than `Delta`.  With a large `Delta`, honest messages will essentially never be orphaned. 

A message disliked by FPC will not be added to `eligibleTipsList` and thus will be orphaned.  Moreover, a message will be orphaned if some message in its past cone is disliked by FPC.  In this way, the algorithms enforce monotonicity in FPC voting, without traversing the tangle marking flags.

Since messages with questionable timestamps will not be flagged eligible until FPC resolves their status, honest messages should not approve them.  Thus, an attacker cannot trick honest messages into being orphaned.

It is necessary that `Delta>w+D` in order to prevent the following attack.  Suppose `w=30`, `D=5`, and `Delta=5`.  Given these parameters, an attacker can maintain a chain of messages whose tip always has a timestamp between `currentTime-10` and `currentTime-15`,   because the timestamps in this interval will always be valid. However, the confirmation confidence of every message in this chain will always be `0` because each message is older than `Delta`.  At anytime, the attacker can orphan the entire chain by ceasing issueing messages, but the attacker can also  have the chain reach full confirmation confidence by issueing tips with current timestamps. Thus the status of this chain is indeterminable: the messages are neither "in" nor "out" of the ledger.  This is effectively a liveness attack.  

To summarize, bad messages will be orphaned, and honest messages will not.  Moreover, we claim that there is no middle ground: regardless of an attacker's actions, all messages flagged as eligible will not be orphaned, with high probability.   Indeed, `Delta` will be set significantly greater than `w+D`, thus any message added to the eligible tip list will be eligible for tip selection long enough that it will be eventually selected with high probability.  


### Alternatives

Tips in the eligible tip list might expire, although this should not happen very often given the discussion above. Such tips will be removed from `eligibleTipList` during snapshotting.  However, to optimize efficiency, a node may want to occasionally clean the `eligibleTipList` of expired tips.

Similarly, the `pending` list can be regularly cleaned of messages which will never become eligible.  Indeed, if any message directly references a message with `opinion=FaLSE`  or `level` 2 or 3, that message can be eliminated from the pending list.  However, if they are not, they will be scrubbed from the pending list during the snapshot.  

Periodically cycling through the pending list may not be efficient.  Instead, a node can check the `pending` list when it performs an action which might cause a message to become eligible.  For example, if FPC changes the opinion of a message to `True`  with `level=3`, the node can immediately remove the message, can flag it as eligible and move it to the `eligibleTipList`.  Similarly, whenever a message is flagged eligible, a node can search `pending` for messages which reference it, and then check if these messages can now be flagged as eligible.  
 
### Open questions

In the previous section, we make some fairly bold claims, but these still need to be analyzed thoroughly. Rough calculations and intuition support our claims, but rigorous analysis is needed. Specifically, we need to understand:
* The probability of being orphaned as a function of `Delta`.
* The attack strategies for preventing good transactions from being approved.
* The effects of malicious structures such as blowballs forming in the tangle. 
We know for instance the probability of being orphaned is "small", but we do not know how small: is it say $10^{-4}$ or $10^{-12}$?  


## 4. Finality

Users need to know when their information has been successfully added to the tangle.  In other words, they need to know when their information will not be orphaned.  However, finality is inherently probabilistic.  For instance, consider the following scenario. An attacker can trivially maintain a chain of messages that do not approve any other message.  At any given point in time, it is possible that all messages will be orphaned except this chain.  This is incredibly unlikely, but yet still possible.  

We introduce several grades of finality.  The higher grade the finality, the less likely it is to be orphaned.  

We do not specify any algorithms for computing which messages have these degrees of finality: this is the prerogative of the node software. 

### Detailed Design

There are three grades of finality for a message.
* Grade 1: The message and every message in its history satisfy the following: the opinion is `TRUE` and the level is either 2 or 3.  In other words, the message has the `eligible` flag set to `True`.
* Grade 2: The message has Grade 1 finality, and the confidence level is greater than `theta` for some parameter.
* Grade 3: The message has Grade 2 finality and the timestamp is older than `T`.

To make these definitions precise, we define the following function:
```
Define: confirmationConfidence
Inputs: messageID
Outputs: number between 0 and 1

Return Probability that getTip indirectly references messageID
```

Grade 2 finality is dependent on the parameter `theta` and, Grade 3 is dependent on both `theta` and `T`.  Thus, these grades exist on a continuum.

### Rationale

A message is "final" if we are sure that it won't be orphaned. Recall that we call a message is orphaned if it is not indirectly referenced by any eligible tips. Unfortunately, finality can never be definitively determined: we can only describe conditions where the probability of orphanage is low. Each of these grades are examples of such conditions. 

To not be orphaned, a message must be eligible for tip selection, hence Grade 1.  Once eligible, it is possible, though unlikely, that it will be orphaned.  This probability decreases quickly as the message gains more approvers.  Hence a message with say 10% confirmation confidence is very unlikely to be orphaned. Thus we have Grade 2.  

There is a small probability that a grade 2 message might be orphahned. This would happen if other nodes did not choose the approving tips before they expired. This is highly unlikely even in the face of an attack.




Moreover, it is exponentially less likely that an old grade 2 message will be orphaned, hence the definition of grade 3.  Let us explain..  Because of the below max depth check, in order for an old message `M` to have grade level 2, `M` must belong to a chain of grade 2 messages whose length is proportional to its age. If  `M` is orphaned, then the whole chain must be orphaned. Thus, the situation described in the previous paragraph would have to repeat several times.

### Open questions

We need to understand the probabilities of orphanage associated with each level of finality.  As discussed earlier, these probabilities should be small, but it would be useful to know how small.  In studying these questions, we may also find that two of these finalities are essentially the same.  

## 5. Snapshotting

Snapshotting may be viewed as merely an optimization. However, since it is critical for nodes, particularly in the IoT setting, we enable it at the protocol level.

 Essentially, a message can be snapshotted when we are sure that all incoming messages directly referencing it will be orphaned. This determination can be made using timestamps. 

### Detailed Design

When `currentTime-messageID.timestamp>snapshotTime`, the node should do the following.
* Remove messageID from `pending` if present
* Remove messageID from `eligibleTipList` if present
* Remove the message from `messageTangle`  

The parameter `snapshotTime` can be set individidually by each node as long as `snapshotTime>w+2D+Delta`.  


### Rationale

Recall that we require that `snapshotTime>w+2D+Delta`.  Suppose a message `M` is snapshotted, and then the node receives a new message `N` which directly references `M`.  Then either:
1. The timestamp is bad level 3
2. The message violates the below max depth rule

In either case, the message `N` will be orphaned by all nodes.  Thus, the node may treat `N` as an unsolid message which can never be solidified, because in this case, `N` will still be orphaned. Moreover, no honest node should be gossiping `N`.

### Alternatives

First, a node can maintain a `snapshotFile` in the following way: when `currentTime-messageID.timestamp>snapshotTime`, the node performs the following.
```
If confirmationconfidence(messageID)>theta  Then
    Add messageID to snapshotFile
    Remove messageID.parent1 from snapshotFile
    Remove messageID.parent2 from snapshotFile
EndIf
```
This file maintains the "tips" of the snapshotted messages and can be communicated to other nodes who are trying to synchronize with the network.  

Second, individual nodes do not necessarily need to delete snapshotted messages, but can simply transfer them to a different area of memory.  For instance, a permanode could move the message into storage.  

## 6. Reattachments

The message tangle is a conflict free replicated data type, which means it contains no conflicts.  Thus a payload of a message can be reattached freely.  This is because the communication layer does not parse the payloads: they are treated just as data.    



















<!--stackedit_data:
eyJkaXNjdXNzaW9ucyI6eyJra0VvZ1ZoeHBPa1pWcldFIjp7In
RleHQiOiJXZSBhc3N1bWUgYWxsIG1lc3NhZ2VzIGFyZSBkZWxp
dmVyZWQgd2l0aGluIHRoaXMgdGltZS4iLCJzdGFydCI6OTUwLC
JlbmQiOjEwMDR9LCJNUk1qZXJqaHk0YllHRWtvIjp7InRleHQi
OiJwZW5kaW5nYCBUaGUgbWVzc2FnZXMgbm90IGVsaWdpYmxlIG
ZvciB0aXAgc2VsZWN0aW9uLiIsInN0YXJ0IjoxNDgxLCJlbmQi
OjE1MzR9LCJYSFd0bXE5bjBsY1VQSHluIjp7InRleHQiOiJNZX
NzYWdlSUQiLCJzdGFydCI6MTk4MywiZW5kIjoxOTkyfSwibFdN
RGFpNFdsQzlHdnBlcSI6eyJ0ZXh0IjoidGltZSBmb3IgZ3JhZG
UgMyBmaW5hbGl0eSBmb3IgbWVzc2FnZXMiLCJzdGFydCI6MTE4
NiwiZW5kIjoxMjI0fSwiSHFkV1dEVFBreE8yb3R1WiI6eyJ0ZX
h0IjoiY29uZmlkZW5jZSBsZXZlbCBvZiBncmFkZSAyIGZpbmFs
aXR5IGZvciBtZXNzYWdlcy4iLCJzdGFydCI6MTEyNywiZW5kIj
oxMTc3fSwiYVlYTG03RUM5ejJMSlR4TiI6eyJ0ZXh0IjoidGlt
ZSIsInN0YXJ0IjoyNTc1LCJlbmQiOjI1Nzl9LCJoTkNLVERkZT
M4YXU1WXV1Ijp7InRleHQiOiJ0aW1lIiwic3RhcnQiOjIyODQs
ImVuZCI6MjI4OH0sIllaT2c3emMxcmJPR2ZsZFoiOnsidGV4dC
I6IndpbGwgYmUgc3RvcmVkIiwic3RhcnQiOjI1MTMsImVuZCI6
MjUyN30sIjhabUNFc2loelhKRk05MTIiOnsidGV4dCI6ImlzIi
wic3RhcnQiOjI5NzQsImVuZCI6Mjk3Nn0sIk9xWWRyWXN5YXJi
SG9ZRWciOnsidGV4dCI6ImN1cnJlbnQgdGltZSIsInN0YXJ0Ij
ozMzYwLCJlbmQiOjMzNzJ9LCJMUnN1THBLY28yMFRsVGUzIjp7
InRleHQiOiJUaGlzIHRpbWUgd2luZG93Iiwic3RhcnQiOjMzNz
QsImVuZCI6MzM5MH0sImZSZ3NGWm5yVGNmZTI0YjMiOnsidGV4
dCI6IldoZW4gYSBtZXNzYWdlIiwic3RhcnQiOjM0NTYsImVuZC
I6MzQ3MH0sIko2aXJIckV1VWxSaU1SMGUiOnsidGV4dCI6Ildo
ZW4gYSBtZXNzYWdlIGlzIGFkZGVkIHRvIHRoZSB0YW5nbGUsIH
RoZSBub2RlIHJ1bnMiLCJzdGFydCI6NDc4MiwiZW5kIjo0ODM0
fSwiN0NRWnYzWUZxaWJ4eFBzVSI6eyJ0ZXh0IjoiaXMgZGVsZX
RlZCIsInN0YXJ0Ijo1MTQ3LCJlbmQiOjUxNTd9LCJqU3dmT2Nt
WjNCdWFqcm9TIjp7InRleHQiOiJjdXJyZW50VGltZS1tZXNzYW
dlSWQudGltZVN0YW1wPERlbHRhIiwic3RhcnQiOjY5NzgsImVu
ZCI6NzAxNX0sIm1lQ0VJcFo1eExNS3VjZ00iOnsidGV4dCI6Im
NvbmZpcm1hdGlvbiBjb25maWRlbmNlIiwic3RhcnQiOjg1NzIs
ImVuZCI6ODU5NX0sIkRPb2w3SklYT09iTEV0WEYiOnsidGV4dC
I6IldlIGtub3cgZm9yIGluc3RhbmNlIHRoZSBwcm9iYWJpbGl0
eSBvZiBiZWluZyBvcnBoYW5lZCBpcyBcInNtYWxsXCIsIGJ1dC
B3ZSBkbyBub+KApiIsInN0YXJ0IjoxMTE5MiwiZW5kIjoxMTMy
Mn0sIktVVVBXbkgzMTBZUFA2bkQiOnsidGV4dCI6ImNvbmZpcm
1hdGlvbkNvbmZpZGVuYyIsInN0YXJ0IjoxMjY1OSwiZW5kIjox
MjY4MH0sImcyTUZ4OWNCWm9oU0V3UWUiOnsidGV4dCI6IlJlY2
FsbCB0Iiwic3RhcnQiOjEzMDI4LCJlbmQiOjEzMDM2fSwiZWNS
VDB1ZzRPTFV1WnpjYyI6eyJ0ZXh0IjoiaGUgZm9sbG93aW5nIi
wic3RhcnQiOjE1MTMzLCJlbmQiOjE1MTQ1fSwiQ05zWEJ2QTNE
ejhJZzZYaSI6eyJ0ZXh0IjoiVGlwcyBzZWxlY3Rpb24iLCJzdG
FydCI6NTQzMiwiZW5kIjo1NDQ2fSwiUktxOWVrbXVVa1V3SHhl
dSI6eyJ0ZXh0IjoiTW9yZW92ZXIsIiwic3RhcnQiOjczMTYsIm
VuZCI6NzMyNX0sImxCdmd0YkdhQlR2ZlZTWWciOnsidGV4dCI6
IklvdGEiLCJzdGFydCI6NzQzMiwiZW5kIjo3NDM2fSwiVXNQbF
pFMVhBdXMwN1NMMCI6eyJ0ZXh0Ijoid2VhayBOYXNoIGVxdWls
aWJyaXVtOiIsInN0YXJ0Ijo3MjI3LCJlbmQiOjcyNDl9LCJQSk
J4d0pmYU1DMGMwSzZpIjp7InRleHQiOiJibG93IGJhbGwgYXR0
YWNrcyIsInN0YXJ0Ijo3Mzc4LCJlbmQiOjczOTV9LCJpU2FNTG
1zTTZlTUtDanhKIjp7InRleHQiOiJXaXRoIGEgbGFyZ2UgYERl
bHRhYCwgaG9uZXN0IG1lc3NhZ2VzIHdpbGwgZXNzZW50aWFsbH
kgbmV2ZXIgYmUgb3JwaGFuZWQuIiwic3RhcnQiOjc2NDMsImVu
ZCI6NzcxNn0sIndOR3d0OHQzanh4NGtaVzMiOnsidGV4dCI6In
dpdGhvdXQgdHJhdmVyc2luZyB0aGUgdGFuZ2xlIG1hcmtpbmcg
ZmxhZ3MuIiwic3RhcnQiOjc5NjgsImVuZCI6ODAxMn0sImdWRU
pCNXVKSXBjRXhNM3MiOnsidGV4dCI6ImZvbGxvd2luZyBhdHRh
Y2siLCJzdGFydCI6ODI4OCwiZW5kIjo4MzA0fSwiR05iRDdKaF
V0eDloY1hxUyI6eyJ0ZXh0Ijoib3JwaGFuZWQiLCJzdGFydCI6
OTI0OSwiZW5kIjo5MjU3fSwibnFGN2NsY1g4UHZyOW5sVSI6ey
J0ZXh0IjoiRmluYWxpdHkiLCJzdGFydCI6MTEzMzQsImVuZCI6
MTEzNDJ9LCJHRnpjdERRUnlGZnp5OXZ4Ijp7InRleHQiOiJQZX
Jpb2RpY2FsbHkiLCJzdGFydCI6NjI1MywiZW5kIjo2MjY1fSwi
NTI2dzEwQjlReEw3ZEdZZiI6eyJ0ZXh0IjoiR3JhZGUgMSIsIn
N0YXJ0IjoxMjE4MywiZW5kIjoxMjE5MH0sIk1ydzFJR25wWkJD
YkpETGoiOnsidGV4dCI6Ii4iLCJzdGFydCI6MTQwMTYsImVuZC
I6MTQwMTd9LCJ1Y3FTcWpGTFhQdnN1VkdUIjp7InRleHQiOiJS
ZW1vdmUgbWVzc2FnZUlEIGZyb20gYHBlbmRpbmdgIGlmIHByZX
NlbnRcbiogUmVtb3ZlIG1lc3NhZ2VJRCBmcm9tIGBlbGlnaWJs
ZVRpcOKApiIsInN0YXJ0IjoxNTE0OSwiZW5kIjoxNTI4Nn0sIm
xVOXY3RncydFdIS0tuT2MiOnsidGV4dCI6IkRlbHRhPm1lc3Nh
Z2VJRC50aW1lc3RhbXAtbWVzc2FnZUlELnBhcmVudDEudGltZV
N0YW1wID4wIiwic3RhcnQiOjQ4ODQsImVuZCI6NDk0MH19LCJj
b21tZW50cyI6eyJYV0M3ckNXV3U5c0UzUjh2Ijp7ImRpc2N1c3
Npb25JZCI6ImtrRW9nVmh4cE9rWlZyV0UiLCJzdWIiOiJnaDo1
MTExMjYxOCIsInRleHQiOiJUaGlzIGlzIGEgc3Ryb25nIGFzc3
VtcHRpb24gYW5kIG1heSBiZSBpbnRlcnByZXRlZCBpbiBhIHdy
b25nIHdheS4gV2hhdCBoYXBwZW5zIG9mIG9uZSBtZXNzYWdlIG
lzIG5vdCBkZWxpdmVyZWQgb24gdGltZT8gUHJvdG9jb2wgYnJl
YWtzPyIsImNyZWF0ZWQiOjE1OTU1NzI2MjQ5MzN9LCJJYzlzZn
d5VnA5eHZSWGZJIjp7ImRpc2N1c3Npb25JZCI6Ik1STWplcmpo
eTRiWUdFa28iLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOi
JJcyB0aGlzIHRoZSBNZXNzYWdlIEluYm94IGZyb20gMS0zID8i
LCJjcmVhdGVkIjoxNTk1NTcyNzU1MzYxfSwiQVFnMm1pcjZ1WH
BDT0kxNiI6eyJkaXNjdXNzaW9uSWQiOiJNUk1qZXJqaHk0YllH
RWtvIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiUHJvYm
FibHkgb25seSB0aGUgc3Vic2V0IHRoYXQgaXMgbm9uLWVsaWdp
YmxlLiIsImNyZWF0ZWQiOjE1OTU1NzI3OTM2OTN9LCJGWVhVVz
dVT1k1ZW9zSkJqIjp7ImRpc2N1c3Npb25JZCI6IlhIV3RtcTlu
MGxjVVBIeW4iLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOi
JtZXNzYWdlSUQ/IiwiY3JlYXRlZCI6MTU5NTU3Mjk4NjgxN30s
ImF5VFprUGs3cll0TmJBWkMiOnsiZGlzY3Vzc2lvbklkIjoibF
dNRGFpNFdsQzlHdnBlcSIsInN1YiI6ImdoOjUxMTEyNjE4Iiwi
dGV4dCI6Im5vdCBjbGVhciB3aXRob3V0IGtub3dpbmcgd2hhdC
BpdCBpcyBhbHJlYWR5IiwiY3JlYXRlZCI6MTU5NTU3MzQ0MDI1
M30sIkFnRk5OWEhrcU1MZ1c1M2siOnsiZGlzY3Vzc2lvbklkIj
oiSHFkV1dEVFBreE8yb3R1WiIsInN1YiI6ImdoOjUxMTEyNjE4
IiwidGV4dCI6ImRvbiB0IHVuZGVyc3RhbmQiLCJjcmVhdGVkIj
oxNTk1NTczNDc5MTA4fSwiZTZtVFczQVBWekVORVJOcCI6eyJk
aXNjdXNzaW9uSWQiOiJhWVhMbTdFQzl6MkxKVHhOIiwic3ViIj
oiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiSSBzdWdnZXN0IHRvIGFs
d3lhcyB3cml0ZSBcImxvY2FsIHRpbWVcIiBpZiBpdCBpcyB0aG
UgbG9jYWwgdGltZSBvZiBhIHBhcnRpY3VsYXIgbm9kZSIsImNy
ZWF0ZWQiOjE1OTU1NzM3NzkzMTl9LCJCWU5QdXVEWlVMSlVSNk
FlIjp7ImRpc2N1c3Npb25JZCI6ImhOQ0tURGRlMzhhdTVZdXUi
LCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJTdHJpY3RseS
BzcGVha2luZyB0aGlzIGlzIG5vdCBhIHRpbWUsIG1vcmUgYSBw
b2ludCBpbiB0aW1lICh3ZSBiZWxpZXZlIHRvIGxpdmUgaW4pLi
BVTklYLXRpbWU/IiwiY3JlYXRlZCI6MTU5NTU3NDUzMjg3M30s
IlpQdnVvRkxnVnJVbVgyYkciOnsiZGlzY3Vzc2lvbklkIjoiWV
pPZzd6YzFyYk9HZmxkWiIsInN1YiI6ImdoOjUxMTEyNjE4Iiwi
dGV4dCI6IndoZXJlIHdpbGwgdGhleSBiZSBzdG9yZWQ/IiwiY3
JlYXRlZCI6MTU5NTU3NDYzNjU3OX0sIktpNm1kaW9QU0dpT0tq
c1ciOnsiZGlzY3Vzc2lvbklkIjoiOFptQ0VzaWh6WEpGTTkxMi
IsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Im1ha2UgY29u
c2lzdGVudDsgc3RhcnQgdXBwZXIgb3IgbG93ZXIgY2FzZSBhZn
RlciAnICcsIG9yIHVzZSA6ID8iLCJjcmVhdGVkIjoxNTk1NTc0
NzY3MDU5fSwicTNPUTlCb2dvNDhoVTRUcCI6eyJkaXNjdXNzaW
9uSWQiOiI4Wm1DRXNpaHpYSkZNOTEyIiwic3ViIjoiZ2g6NTEx
MTI2MTgiLCJ0ZXh0IjoidXNlIHRoZSBzYW1lIHRocm91Z2hvdX
QgdGhlIHNwZWNzIiwiY3JlYXRlZCI6MTU5NTU3NDgxMjcxNn0s
InZZajM0VXpIRnRPdWtIc0giOnsiZGlzY3Vzc2lvbklkIjoiT3
FZZHJZc3lhcmJIb1lFZyIsInN1YiI6ImdoOjUxMTEyNjE4Iiwi
dGV4dCI6ImN1cnJlbnQgbG9jYWwgdGltZT8iLCJjcmVhdGVkIj
oxNTk1NTc1MDA5MjY1fSwiYWFSNTNSYlpqcmFOUWhqbyI6eyJk
aXNjdXNzaW9uSWQiOiJPcVlkcllzeWFyYkhvWUVnIiwic3ViIj
oiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiaWYgaXQgcmVmZXJzIHRv
IHRoZSB2YXJpYWJsZSBgY3VycmVudCB0aW1lYGFkZCB0aGVzZS
BgcyIsImNyZWF0ZWQiOjE1OTU1NzUwODYzOTl9LCJ2S0dBRWM3
RWQzREwzQzVzIjp7ImRpc2N1c3Npb25JZCI6IkxSc3VMcEtjbz
IwVGxUZTMiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJC
VFcgd2hlcmUgaXMgaXQgc3BlY2lmaWVkIGhvdyB0byBjaG9vc2
UgdyBhbmQgdGhlIG90aGVyIHBhcmFtZXRlcnM/IiwiY3JlYXRl
ZCI6MTU5NTU3NTE0MzQzN30sIlRwM1B4WVVtTjhEcHV2ZWsiOn
siZGlzY3Vzc2lvbklkIjoiZlJnc0ZabnJUY2ZlMjRiMyIsInN1
YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IklzIHRoaXMgYWZ0ZX
IgdGhlIG1lc3NhZ2UgcGFzc2VkIHRoZSByYXRlIG1hbmFnZXI/
IElmIHllcywgSSBtIGEgYml0IGNvbmZ1c2VkLCBub2RlIHdpdG
ggZGlmZmVyZW50IG1hbmEgcGVyY2VwdGlvbiBtaWdodCBoYW5k
bGUgdGhlIG1lc3NhZ2UgZGlmZmVyZW50bHkiLCJjcmVhdGVkIj
oxNTk1NTc1NTYzMTcwfSwiVjRkS2Jmd1E3UFhCRkljNiI6eyJk
aXNjdXNzaW9uSWQiOiJKNmlySHJFdVVsUmlNUjBlIiwic3ViIj
oiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiRG9lcyB0aGlzIGNvbWUg
YmVmb3JlIHRoZSBhYm92ZSBzdGVwIG9yIGFmdGVyPyBBIGdyYX
BoIGxpa2UgaW4gMS0zIHNob3dpbmcgdGhlIHByb2Nlc3NlcyBt
aWdodCBiZSBnb29kIiwiY3JlYXRlZCI6MTU5NTU3NjEyNTczMX
0sIncycVU4RERYQ3NSZ3RkRkgiOnsiZGlzY3Vzc2lvbklkIjoi
N0NRWnYzWUZxaWJ4eFBzVSIsInN1YiI6ImdoOjUxMTEyNjE4Ii
widGV4dCI6ImZyb20gd2hlcmU/IE1lc3NhZ2UgSW5ib3g/IFN0
aWxsIGdvc3NpcGVkIG9yIG5vdD8iLCJjcmVhdGVkIjoxNTk1NT
c2MTU5NDA1fSwiTFB2VXREUTVPZWxrOHlDNSI6eyJkaXNjdXNz
aW9uSWQiOiJKNmlySHJFdVVsUmlNUjBlIiwic3ViIjoiZ2g6NT
ExMTI2MTgiLCJ0ZXh0IjoiT3IgaXMgdGhpcyBjb250YWluZWQg
aW4gdGhlIHRpbWVzdGFtcCBjaGVjayBpbiAxLTM/IiwiY3JlYX
RlZCI6MTU5NTU3NjI5NjI1Nn0sImszWERYVVJoMXl0NWk3d1ci
OnsiZGlzY3Vzc2lvbklkIjoialN3Zk9jbVozQnVhanJvUyIsIn
N1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6ImRvbiB0IHVuZGVy
c3RhbmQ/IElzIHRoaXMgZ2V0VGlwIGZvciBuZXcgbWVzc2FnZS
5JRD8iLCJjcmVhdGVkIjoxNTk1NTc2OTIzNjI4fSwiNVh2c1NM
ejBxbkd0ZmFxYiI6eyJkaXNjdXNzaW9uSWQiOiJtZUNFSXBaNX
hMTUt1Y2dNIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ijoi
d2hlcmUgaXMgdGhpcyBkZWZpbmVkPyIsImNyZWF0ZWQiOjE1OT
U1NzcxODEyNTl9LCJ3ZXRPNkZBT2FkYlk0WmVlIjp7ImRpc2N1
c3Npb25JZCI6IkRPb2w3SklYT09iTEV0WEYiLCJzdWIiOiJnaD
o1MTExMjYxOCIsInRleHQiOiJUaGlzIHNob3VsZCBiZSBjYWxj
dWxhYmxlLiBVbmRlciBzb21lIGFzc3VtcHRpb25zIG9mIG1hbG
ljaW91cyBtcHMgYW5kIGhvbmVzdCBtcHMgZXZlbiB0aGVvcmV0
aWNhbGx5LiIsImNyZWF0ZWQiOjE1OTU1Nzc2MzE3NTZ9LCJsan
dvU3M3QU9aVTRlRzNxIjp7ImRpc2N1c3Npb25JZCI6IktVVVBX
bkgzMTBZUFA2bkQiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleH
QiOiJJcyB0aGlzIHRoZSBkZWZpbml0aW9uIG9mIGNvbmZpZGVu
Y2UgbGV2ZWw/IiwiY3JlYXRlZCI6MTU5NTU3Nzk2NTMzMX0sIm
VLQ0lFb1N3MjhxcFVLWE4iOnsiZGlzY3Vzc2lvbklkIjoiZzJN
Rng5Y0Jab2hTRXdRZSIsInN1YiI6ImdoOjUxMTEyNjE4IiwidG
V4dCI6IndoZXJlIGlzIHRoaXMgZGVmaW5lZD8iLCJjcmVhdGVk
IjoxNTk1NTc4MDI4NzAxfSwiRFRxZGhBMThoMXdwUndudSI6ey
JkaXNjdXNzaW9uSWQiOiJlY1JUMHVnNE9MVXVaemNjIiwic3Vi
IjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiaXMgdGhlcmUgYSBjaG
FuY2UgdGhhdCBhIG1lc3NhZ2UgZ2V0cyB0cmFwcGVkIGluIHRo
ZSBNZXNzYWdlIEluYm94IGFuZCBoYXMgdG8gYmUgcmVtb3ZlZC
B0b28/IiwiY3JlYXRlZCI6MTU5NTU3ODQ4ODU1MX0sImJlbzk0
d3VjV1ppTEdhSloiOnsiZGlzY3Vzc2lvbklkIjoiQ05zWEJ2QT
NEejhJZzZYaSIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6
IldoYXQgaGFwcGVucyBpZiBlbGlnaWJsZVRpcHNMaXN0IGlzIG
VtcHR5IGZvciBhbGwgbm9kZXM/IFNob3VsZCBudCB3ZSB0aGlu
ayBhYm91dCBoYW5kbGluZyB0aGlzIGNhc2U/IiwiY3JlYXRlZC
I6MTU5NTU3ODYzMTEzNn0sInJHVHIxVkYwbUZRY2pkMjgiOnsi
ZGlzY3Vzc2lvbklkIjoiTFJzdUxwS2NvMjBUbFRlMyIsInN1Yi
I6ImdoOjY4MjUwMzUwIiwidGV4dCI6IlVzdWFsbHkgU2VyZ3Vl
aSBzYXlzIFwiUHV0IGFueSByZWFzb25hYmxlIGluaXRpYWwgcG
FyYW1ldGVyIGFuZCB3ZSBjaGFuZ2UgYWZ0ZXIgdGVzdGluZ1wi
LiIsImNyZWF0ZWQiOjE1OTU4NzkzNzc3MDB9LCJlN0pZWkRpUH
BrM0d4akFlIjp7ImRpc2N1c3Npb25JZCI6Iko2aXJIckV1VWxS
aU1SMGUiLCJzdWIiOiJnaDo2ODI1MDM1MCIsInRleHQiOiJGcm
9tIHRoZSBsYXN0IGRpc2N1c3Npb24gZnJvbSB0aGUgZ3JvdXAs
IEJNRCBjaGVjayBpcyBwYXJ0IG9mIHNvbGlkaWZpY2F0aW9uLC
BwZWhhcHMgd2UgbmVlZCB0byBjaGFuZ2Ugc2Vzc2lvbnMgdG8g
cmVmbGVjdCB0aGlzPyBJIHdpbGwgZGlzY3VzcyB0aGlzIGluIH
RoZSBwcm90b2NvbCBjYWxsIHRvbW9ycm93ISIsImNyZWF0ZWQi
OjE1OTU4Nzk3MDIzNzJ9LCJqMnFqb0thNTVvQkE2MzlzIjp7Im
Rpc2N1c3Npb25JZCI6IlJLcTlla211VWtVd0h4ZXUiLCJzdWIi
OiJnaDo2ODI1MDM1MCIsInRleHQiOiJSZXBlYXRlZCBcIk1vcm
VvdmVyXCIsIHVzZSBvdGhlciB3b3JkIGxpa2UgXCJBZGRpdGlv
bmFsbHlcIiIsImNyZWF0ZWQiOjE1OTU4ODAwNDI1NjF9LCJFUj
RtS0JwRTdNYTJUNTZlIjp7ImRpc2N1c3Npb25JZCI6ImxCdmd0
YkdhQlR2ZlZTWWciLCJzdWIiOiJnaDo2ODI1MDM1MCIsInRleH
QiOiJJT1RBIiwiY3JlYXRlZCI6MTU5NTg4MDA3NDI1M30sIkxa
NHJrWkZUYzd4Zkk2OVIiOnsiZGlzY3Vzc2lvbklkIjoiVXNQbF
pFMVhBdXMwN1NMMCIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4
dCI6IklzIGl0IG9rIHRvIHVzZSB0aGUgbWF0aGVtYXRpY2FsIH
Rlcm1pbm9sb2d5IGhlcmU/IiwiY3JlYXRlZCI6MTU5NTg4MDc0
MDUwMX0sInB1eUhEY2YyVWZWbmRyb0IiOnsiZGlzY3Vzc2lvbk
lkIjoiUEpCeHdKZmFNQzBjMEs2aSIsInN1YiI6ImdoOjY4MjUw
MzUwIiwidGV4dCI6IldlIG5lZWQgdG8gZGVmaW5lIGF0dGFja3
Mgc29tZXdoZXJlLiBBbHNvLCBkb2VzIGl0IG1ha2Ugc2Vuc2Ug
dG8gaGF2ZSBhIGJsb3diYWxsIGF0dGFjayB3aXRoIG5vIG1pbG
VzdG9uZXM/IiwiY3JlYXRlZCI6MTU5NTg4MDgwMzM4OH0sIk95
RFB5c3JNSmNjMGVuVm4iOnsiZGlzY3Vzc2lvbklkIjoiaVNhTU
xtc002ZU1LQ2p4SiIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4
dCI6IkkgYmVsaWV2ZSB3ZSBjYW4gYmUgcHJlY2lzZSBoZXJlIH
dpdGggc29tZSBtYXRoIGZyb20gVFMuLi4iLCJjcmVhdGVkIjox
NTk1ODgwODY4MDQ5fSwidTZTcE9HZFlBOWp2Z25yRCI6eyJkaX
NjdXNzaW9uSWQiOiJ3Tkd3dDh0M2p4eDRrWlczIiwic3ViIjoi
Z2g6NjgyNTAzNTAiLCJ0ZXh0IjoiSXNuJ3QgY2hlY2tpbmcgcG
FzdCBjb25lIGp1c3QgYXMgZXhwZW5zaXZlPyIsImNyZWF0ZWQi
OjE1OTU4ODA5MTM4MTF9LCJ0THFETm9jTnRKMldPSkZGIjp7Im
Rpc2N1c3Npb25JZCI6ImdWRUpCNXVKSXBjRXhNM3MiLCJzdWIi
OiJnaDo2ODI1MDM1MCIsInRleHQiOiJQZWhhcHMgYSBzZWN0aW
9uIGRlc2NyaWJpbmcgcG9zc2libGUgYXR0YWNrcyB3b3VsZCBt
aWtlIHRoZSBmaWxlIGNsZWFuZXIiLCJjcmVhdGVkIjoxNTk1OD
gxMTExNTY3fSwiUk1pME1yUVJKVHBFUkFnNCI6eyJkaXNjdXNz
aW9uSWQiOiJHTmJEN0poVXR4OWhjWHFTIiwic3ViIjoiZ2g6Nj
gyNTAzNTAiLCJ0ZXh0IjoiV2UgbmVlZCB0byBkZWZpbmUgdGhl
IHRlcm0gXCJvcnBoYW5hZ2VcIiBiZWZvcmUgdXNpbmcgaXQiLC
JjcmVhdGVkIjoxNTk1ODgxMzg1NTI0fSwibmdtaVJIT1BsTFlR
MDZVbCI6eyJkaXNjdXNzaW9uSWQiOiJucUY3Y2xjWDhQdnI5bm
xVIiwic3ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiRm9sbG93
aW5nIFNlYmFzdGlhbnMgQ29tbWVudHMgSSB3b3VsZCBzdWdnZX
N0IHRoaXMgc2VjdGlvbiB0byBjb21lIGJlZm9yZSwgc2luY2Ug
d2UgbWFueSB0aW1lcyB0YWxrIGFib3V0IG9ycGhhbmFnZSBhbm
QgZmluYWxpdHkgYmVmb3JlLiIsImNyZWF0ZWQiOjE1OTU4ODIy
MzgyNzB9LCI0Y00yRThBZ0FsbDAzNDdiIjp7ImRpc2N1c3Npb2
5JZCI6IkdGemN0RFFSeUZmenk5dngiLCJzdWIiOiJnaDo2ODI1
MDM1MCIsInRleHQiOiJUaGlzIHNob3VsZCBpbmR1Y2UgYSBuZX
cgcGFyYW1ldGVyIiwiY3JlYXRlZCI6MTU5NTg5NzI0ODMwNn0s
IlA2NW9Fc0FEV29nTHZxa0UiOnsiZGlzY3Vzc2lvbklkIjoiNT
I2dzEwQjlReEw3ZEdZZiIsInN1YiI6ImdoOjY4MjUwMzUwIiwi
dGV4dCI6IldlIGluaXRpYWxseSBpbnRyb2R1Y2VkIDQgZ3JhZG
VzLCBzbyB3ZSBjb3VsZCBoYXZlIG9uZSBraW5kIG9mIGZpbmFs
aXR5IGluIHNvbWUgc2Vjb25kcyAodGhlIHNtYWxsIG5ldHdvcm
sgZGVsYXkgd2l0aCBubyBjb25mbGljdHMpLCBJIGZlZWwgbGlr
ZSBjaGFuZ2luZyBpdCBpcyBiYWQgZm9yIFBSLiIsImNyZWF0ZW
QiOjE1OTU4OTc5ODM4MzB9LCJYa211SmdLakhIZ2RrNjJHIjp7
ImRpc2N1c3Npb25JZCI6Ik1ydzFJR25wWkJDYkpETGoiLCJzdW
IiOiJnaDo2ODI1MDM1MCIsInRleHQiOiI6IiwiY3JlYXRlZCI6
MTU5NTg5ODA0MDUzNn0sIjNIeEVzZHVRczFVcUxuWkIiOnsiZG
lzY3Vzc2lvbklkIjoidWNxU3FqRkxYUHZzdVZHVCIsInN1YiI6
ImdoOjY4MjUwMzUwIiwidGV4dCI6IlNob3VsZG4ndCB0aGlzIG
JlIGluIHBzZXVkby1BbGdvcml0aG0/IiwiY3JlYXRlZCI6MTU5
NTg5ODgwOTE3MX0sInFGUnNyaG05RklKYXR2TlQiOnsiZGlzY3
Vzc2lvbklkIjoibFU5djdGdzJ0V0hLS25PYyIsInN1YiI6Imdo
OjUxMTEyNjE4IiwidGV4dCI6IkluIHBhcnRpY3VsYXIsIHRoaX
MgZW5mb3JjZXMgbW9ub3RvbmljaXR5IG9mIHRpbWVzdGFtcHMs
IFwiPjBcIiwgVGhpcyBpcyBzb21laG93IGhpZGRlbiBoZXJlIG
FuZCBzaG91bGQgYmUgbW92ZWQgdG8gVGltZXN0YW1wQ2hlY2si
LCJjcmVhdGVkIjoxNTk1OTE1MjgwMDQ5fSwiTm1uWjAxbWJPQj
hHdFhLYiI6eyJkaXNjdXNzaW9uSWQiOiJra0VvZ1ZoeHBPa1pW
cldFIiwic3ViIjoiZ2g6NTA2NjE4NDQiLCJ0ZXh0IjoiQmFzaW
NhbGx5LiAgQSBub2RlIGlzIHRocm93biBvdXQgb2Ygc3luYy4i
LCJjcmVhdGVkIjoxNTk1OTI1MDYxNDY4fSwiTU5XaDVvMnhBbF
drbk5FMCI6eyJkaXNjdXNzaW9uSWQiOiJsV01EYWk0V2xDOUd2
cGVxIiwic3ViIjoiZ2g6NTA2NjE4NDQiLCJ0ZXh0IjoiSW0gbm
90IHN1cmUgaG93IHRvIGRlZmluZSBpdCBpbiBjb25jaXNlIHdh
eS4iLCJjcmVhdGVkIjoxNTk1OTI1MTEwNjY4fX0sImhpc3Rvcn
kiOlstNDAzNTE2MzAsLTExMDIzMzQ3OTRdfQ==
-->