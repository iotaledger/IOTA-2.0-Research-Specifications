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
* `opinionField` Contains the nodes' opinion on the timestamp of a message.  As specified [here](https://hackmd.io/xBfQ04NkRi6IrwhEQm7aJQ), this field is a triple `(opinion,level,timeFormed)`, where `opinion` is a Boolean value, `level` is in the set {1,2,3}, and `timeFormed` is a time. Theis `opinionField` is also manipulated by FPC.
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

RURTS is easy to implement, computationally inexpensive, and minimises orphanage. Moreover, it is in weak Nash equilibrium: honest users have nothing to gain by deviating from the protocol. Moreover, this tip selection algorithm should be resistant to blow ball attacks.  

As demonstrated in the original Iota white paper and subsequent simulations, URTS has no orphans.  Theoretically, RURTS should largely approximate URTS.  The only difference is that some tips may "expire" when they become older than `Delta`.  With a large `Delta`, honest messages will essentially never be orphaned. 

A message disliked by FPC will not be added to `eligibleTipsList` and thus will be orphaned.  Moreover, a message will be orphaned if some message in its past cone is disliked by FPC.  In this way, the algorithms enforce monotonicity in FPC voting, without traversing the tangle marking flags.

Since messages with questionable timestamps will not be flagged eligible until FPC resolves their status, honest messages should not approve them.  Thus, an attacker cannot trick honest messages into being orphaned.

It is necessary that `Delta>w+D` in order to prevent the following attack.  Suppose `w=30`, `D=5`, and `Delta=5`.  Given these parameters, an attacker can maintain a chain of messages whose tip always has a timestamp between `currentTime-10` and `currentTime-15`,   because the timestamps in this interval will always be valid. However, the confirmation confidence of every message in this chain will always be `0` because each message is older than `Delta`.  At anytime, the attacker can orphan the entire chain by ceasing issuing messages, but the attacker can also  have the chain reach full confirmation confidence by issuing tips with current timestamps. Thus the status of this chain is indeterminable: the messages are neither "in" nor "out" of the ledger.  This is effectively a liveness attack.  

To summarise, bad messages will be orphaned, and honest messages will not.  Moreover, we claim that there is no middle ground: regardless of an attacker's actions, all messages flagged as eligible will not be orphaned, with high probability.   Indeed, `Delta` will be set significantly greater than `w+D`, thus any message added to the eligible tip list will be eligible for tip selection long enough that it will be eventually selected with high probability.  


### Alternatives

Tips in the eligible tip list might expire, although this should not happen very often given the discussion above. Such tips will be removed from `eligibleTipList` during snapshotting.  However, to optimize efficiency, a node may want to occasionally clean the `eligibleTipList` of expired tips.

Similarly, the `pending` list can be regularly cleaned of messages which will never become eligible.  Indeed, if any message directly references a messages with `opinion=FaLSE`  or `level` 2 or 3, that message can be eliminated from the pending list.  However, if they are not, they will be scrubbed from the pending list during the snapshot.  

Periodically cycling through the pending list may not be efficient.  Instead, a node can check the `pending` list when it performs an action which might cause a message to becomem eligible.  For example, if FPC changes the opinion of a message to `True`  with `level=3`, the node can immediately remove the message, can flag it as eligible and move it to the `eligibleTipList`.  Similarly, whenever a message is flagged eligible, a node can search `pending` for messages which reference it, and then check if these messages can now be flagged as eligible.  
 
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




Moreover, it is exponentially less likely that an old grade 2 message will be orphaned, hence the definition of grade 3.  Let us explain.  Because of the below max depth check, in order for an old message `M` to have grade level 2, `M` must belong to a chain of grade 2 messages whose length is proportional to its age. If  `M` is orphaned, then the whole chain must be orphaned. Thus, the situation described in the previous paragraph would have to repeat several times.

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
wic3RhcnQiOjI5NzYsImVuZCI6Mjk3OH0sIk9xWWRyWXN5YXJi
SG9ZRWciOnsidGV4dCI6ImN1cnJlbnQgdGltZSIsInN0YXJ0Ij
ozMzYyLCJlbmQiOjMzNzR9LCJMUnN1THBLY28yMFRsVGUzIjp7
InRleHQiOiJUaGlzIHRpbWUgd2luZG93Iiwic3RhcnQiOjMzNz
YsImVuZCI6MzM5Mn0sImZSZ3NGWm5yVGNmZTI0YjMiOnsidGV4
dCI6IldoZW4gYSBtZXNzYWdlIiwic3RhcnQiOjM0NTgsImVuZC
I6MzQ3Mn0sIko2aXJIckV1VWxSaU1SMGUiOnsidGV4dCI6Ildo
ZW4gYSBtZXNzYWdlIGlzIGFkZGVkIHRvIHRoZSB0YW5nbGUsIH
RoZSBub2RlIHJ1bnMiLCJzdGFydCI6NDc4NCwiZW5kIjo0ODM2
fSwiN0NRWnYzWUZxaWJ4eFBzVSI6eyJ0ZXh0IjoiaXMgZGVsZX
RlZCIsInN0YXJ0Ijo1MTQ5LCJlbmQiOjUxNTl9LCJqU3dmT2Nt
WjNCdWFqcm9TIjp7InRleHQiOiJjdXJyZW50VGltZS1tZXNzYW
dlSWQudGltZVN0YW1wPERlbHRhIiwic3RhcnQiOjY5ODAsImVu
ZCI6NzAxN30sIm1lQ0VJcFo1eExNS3VjZ00iOnsidGV4dCI6Im
NvbmZpcm1hdGlvbiBjb25maWRlbmNlIiwic3RhcnQiOjg1NzMs
ImVuZCI6ODU5Nn0sIkRPb2w3SklYT09iTEV0WEYiOnsidGV4dC
I6IldlIGtub3cgZm9yIGluc3RhbmNlIHRoZSBwcm9iYWJpbGl0
eSBvZiBiZWluZyBvcnBoYW5lZCBpcyBcInNtYWxsXCIsIGJ1dC
B3ZSBkbyBub+KApiIsInN0YXJ0IjoxMTE5MywiZW5kIjoxMTMy
M30sIktVVVBXbkgzMTBZUFA2bkQiOnsidGV4dCI6ImNvbmZpcm
1hdGlvbkNvbmZpZGVuYyIsInN0YXJ0IjoxMjY2MCwiZW5kIjox
MjY4MX0sImcyTUZ4OWNCWm9oU0V3UWUiOnsidGV4dCI6IlJlY2
FsbCB0Iiwic3RhcnQiOjEzMDI5LCJlbmQiOjEzMDM3fSwiZWNS
VDB1ZzRPTFV1WnpjYyI6eyJ0ZXh0IjoiaGUgZm9sbG93aW5nIi
wic3RhcnQiOjE1MTMzLCJlbmQiOjE1MTQ1fSwiQ05zWEJ2QTNE
ejhJZzZYaSI6eyJ0ZXh0IjoiVGlwcyBzZWxlY3Rpb24iLCJzdG
FydCI6NTQzNCwiZW5kIjo1NDQ4fSwiUktxOWVrbXVVa1V3SHhl
dSI6eyJzdGFydCI6NzMxNywiZW5kIjo3MzI2LCJ0ZXh0IjoiTW
9yZW92ZXIsIn0sImxCdmd0YkdhQlR2ZlZTWWciOnsic3RhcnQi
Ojc0MzMsImVuZCI6NzQzNywidGV4dCI6IklvdGEifSwiVXNQbF
pFMVhBdXMwN1NMMCI6eyJzdGFydCI6NzIyOCwiZW5kIjo3MjUw
LCJ0ZXh0Ijoid2VhayBOYXNoIGVxdWlsaWJyaXVtOiJ9LCJQSk
J4d0pmYU1DMGMwSzZpIjp7InN0YXJ0Ijo3Mzc5LCJlbmQiOjcz
OTYsInRleHQiOiJibG93IGJhbGwgYXR0YWNrcyJ9LCJpU2FNTG
1zTTZlTUtDanhKIjp7InN0YXJ0Ijo3NjQ0LCJlbmQiOjc3MTcs
InRleHQiOiJXaXRoIGEgbGFyZ2UgYERlbHRhYCwgaG9uZXN0IG
1lc3NhZ2VzIHdpbGwgZXNzZW50aWFsbHkgbmV2ZXIgYmUgb3Jw
aGFuZWQuIn0sIndOR3d0OHQzanh4NGtaVzMiOnsic3RhcnQiOj
c5NjksImVuZCI6ODAxMywidGV4dCI6IndpdGhvdXQgdHJhdmVy
c2luZyB0aGUgdGFuZ2xlIG1hcmtpbmcgZmxhZ3MuIn0sImdWRU
pCNXVKSXBjRXhNM3MiOnsic3RhcnQiOjgyODksImVuZCI6ODMw
NSwidGV4dCI6ImZvbGxvd2luZyBhdHRhY2sifSwiR05iRDdKaF
V0eDloY1hxUyI6eyJzdGFydCI6OTI0OCwiZW5kIjo5MjU2LCJ0
ZXh0Ijoib3JwaGFuZWQifSwibnFGN2NsY1g4UHZyOW5sVSI6ey
JzdGFydCI6MTEzMzUsImVuZCI6MTEzNDMsInRleHQiOiJGaW5h
bGl0eSJ9LCJHRnpjdERRUnlGZnp5OXZ4Ijp7InN0YXJ0Ijo2Mj
U1LCJlbmQiOjYyNjcsInRleHQiOiJQZXJpb2RpY2FsbHkifSwi
NTI2dzEwQjlReEw3ZEdZZiI6eyJzdGFydCI6MTIxODQsImVuZC
I6MTIxOTEsInRleHQiOiJHcmFkZSAxIn19LCJjb21tZW50cyI6
eyJYV0M3ckNXV3U5c0UzUjh2Ijp7ImRpc2N1c3Npb25JZCI6Im
trRW9nVmh4cE9rWlZyV0UiLCJzdWIiOiJnaDo1MTExMjYxOCIs
InRleHQiOiJUaGlzIGlzIGEgc3Ryb25nIGFzc3VtcHRpb24gYW
5kIG1heSBiZSBpbnRlcnByZXRlZCBpbiBhIHdyb25nIHdheS4g
V2hhdCBoYXBwZW5zIG9mIG9uZSBtZXNzYWdlIGlzIG5vdCBkZW
xpdmVyZWQgb24gdGltZT8gUHJvdG9jb2wgYnJlYWtzPyIsImNy
ZWF0ZWQiOjE1OTU1NzI2MjQ5MzN9LCJJYzlzZnd5VnA5eHZSWG
ZJIjp7ImRpc2N1c3Npb25JZCI6Ik1STWplcmpoeTRiWUdFa28i
LCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJJcyB0aGlzIH
RoZSBNZXNzYWdlIEluYm94IGZyb20gMS0zID8iLCJjcmVhdGVk
IjoxNTk1NTcyNzU1MzYxfSwiQVFnMm1pcjZ1WHBDT0kxNiI6ey
JkaXNjdXNzaW9uSWQiOiJNUk1qZXJqaHk0YllHRWtvIiwic3Vi
IjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiUHJvYmFibHkgb25seS
B0aGUgc3Vic2V0IHRoYXQgaXMgbm9uLWVsaWdpYmxlLiIsImNy
ZWF0ZWQiOjE1OTU1NzI3OTM2OTN9LCJGWVhVVzdVT1k1ZW9zSk
JqIjp7ImRpc2N1c3Npb25JZCI6IlhIV3RtcTluMGxjVVBIeW4i
LCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJtZXNzYWdlSU
Q/IiwiY3JlYXRlZCI6MTU5NTU3Mjk4NjgxN30sImF5VFprUGs3
cll0TmJBWkMiOnsiZGlzY3Vzc2lvbklkIjoibFdNRGFpNFdsQz
lHdnBlcSIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Im5v
dCBjbGVhciB3aXRob3V0IGtub3dpbmcgd2hhdCBpdCBpcyBhbH
JlYWR5IiwiY3JlYXRlZCI6MTU5NTU3MzQ0MDI1M30sIkFnRk5O
WEhrcU1MZ1c1M2siOnsiZGlzY3Vzc2lvbklkIjoiSHFkV1dEVF
BreE8yb3R1WiIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6
ImRvbiB0IHVuZGVyc3RhbmQiLCJjcmVhdGVkIjoxNTk1NTczND
c5MTA4fSwiZTZtVFczQVBWekVORVJOcCI6eyJkaXNjdXNzaW9u
SWQiOiJhWVhMbTdFQzl6MkxKVHhOIiwic3ViIjoiZ2g6NTExMT
I2MTgiLCJ0ZXh0IjoiSSBzdWdnZXN0IHRvIGFsd3lhcyB3cml0
ZSBcImxvY2FsIHRpbWVcIiBpZiBpdCBpcyB0aGUgbG9jYWwgdG
ltZSBvZiBhIHBhcnRpY3VsYXIgbm9kZSIsImNyZWF0ZWQiOjE1
OTU1NzM3NzkzMTl9LCJCWU5QdXVEWlVMSlVSNkFlIjp7ImRpc2
N1c3Npb25JZCI6ImhOQ0tURGRlMzhhdTVZdXUiLCJzdWIiOiJn
aDo1MTExMjYxOCIsInRleHQiOiJTdHJpY3RseSBzcGVha2luZy
B0aGlzIGlzIG5vdCBhIHRpbWUsIG1vcmUgYSBwb2ludCBpbiB0
aW1lICh3ZSBiZWxpZXZlIHRvIGxpdmUgaW4pLiBVTklYLXRpbW
U/IiwiY3JlYXRlZCI6MTU5NTU3NDUzMjg3M30sIlpQdnVvRkxn
VnJVbVgyYkciOnsiZGlzY3Vzc2lvbklkIjoiWVpPZzd6YzFyYk
9HZmxkWiIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Indo
ZXJlIHdpbGwgdGhleSBiZSBzdG9yZWQ/IiwiY3JlYXRlZCI6MT
U5NTU3NDYzNjU3OX0sIktpNm1kaW9QU0dpT0tqc1ciOnsiZGlz
Y3Vzc2lvbklkIjoiOFptQ0VzaWh6WEpGTTkxMiIsInN1YiI6Im
doOjUxMTEyNjE4IiwidGV4dCI6Im1ha2UgY29uc2lzdGVudDsg
c3RhcnQgdXBwZXIgb3IgbG93ZXIgY2FzZSBhZnRlciAnICcsIG
9yIHVzZSA6ID8iLCJjcmVhdGVkIjoxNTk1NTc0NzY3MDU5fSwi
cTNPUTlCb2dvNDhoVTRUcCI6eyJkaXNjdXNzaW9uSWQiOiI4Wm
1DRXNpaHpYSkZNOTEyIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0
ZXh0IjoidXNlIHRoZSBzYW1lIHRocm91Z2hvdXQgdGhlIHNwZW
NzIiwiY3JlYXRlZCI6MTU5NTU3NDgxMjcxNn0sInZZajM0VXpI
RnRPdWtIc0giOnsiZGlzY3Vzc2lvbklkIjoiT3FZZHJZc3lhcm
JIb1lFZyIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6ImN1
cnJlbnQgbG9jYWwgdGltZT8iLCJjcmVhdGVkIjoxNTk1NTc1MD
A5MjY1fSwiYWFSNTNSYlpqcmFOUWhqbyI6eyJkaXNjdXNzaW9u
SWQiOiJPcVlkcllzeWFyYkhvWUVnIiwic3ViIjoiZ2g6NTExMT
I2MTgiLCJ0ZXh0IjoiaWYgaXQgcmVmZXJzIHRvIHRoZSB2YXJp
YWJsZSBgY3VycmVudCB0aW1lYGFkZCB0aGVzZSBgcyIsImNyZW
F0ZWQiOjE1OTU1NzUwODYzOTl9LCJ2S0dBRWM3RWQzREwzQzVz
Ijp7ImRpc2N1c3Npb25JZCI6IkxSc3VMcEtjbzIwVGxUZTMiLC
JzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJCVFcgd2hlcmUg
aXMgaXQgc3BlY2lmaWVkIGhvdyB0byBjaG9vc2UgdyBhbmQgdG
hlIG90aGVyIHBhcmFtZXRlcnM/IiwiY3JlYXRlZCI6MTU5NTU3
NTE0MzQzN30sIlRwM1B4WVVtTjhEcHV2ZWsiOnsiZGlzY3Vzc2
lvbklkIjoiZlJnc0ZabnJUY2ZlMjRiMyIsInN1YiI6ImdoOjUx
MTEyNjE4IiwidGV4dCI6IklzIHRoaXMgYWZ0ZXIgdGhlIG1lc3
NhZ2UgcGFzc2VkIHRoZSByYXRlIG1hbmFnZXI/IElmIHllcywg
SSBtIGEgYml0IGNvbmZ1c2VkLCBub2RlIHdpdGggZGlmZmVyZW
50IG1hbmEgcGVyY2VwdGlvbiBtaWdodCBoYW5kbGUgdGhlIG1l
c3NhZ2UgZGlmZmVyZW50bHkiLCJjcmVhdGVkIjoxNTk1NTc1NT
YzMTcwfSwiVjRkS2Jmd1E3UFhCRkljNiI6eyJkaXNjdXNzaW9u
SWQiOiJKNmlySHJFdVVsUmlNUjBlIiwic3ViIjoiZ2g6NTExMT
I2MTgiLCJ0ZXh0IjoiRG9lcyB0aGlzIGNvbWUgYmVmb3JlIHRo
ZSBhYm92ZSBzdGVwIG9yIGFmdGVyPyBBIGdyYXBoIGxpa2UgaW
4gMS0zIHNob3dpbmcgdGhlIHByb2Nlc3NlcyBtaWdodCBiZSBn
b29kIiwiY3JlYXRlZCI6MTU5NTU3NjEyNTczMX0sIncycVU4RE
RYQ3NSZ3RkRkgiOnsiZGlzY3Vzc2lvbklkIjoiN0NRWnYzWUZx
aWJ4eFBzVSIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Im
Zyb20gd2hlcmU/IE1lc3NhZ2UgSW5ib3g/IFN0aWxsIGdvc3Np
cGVkIG9yIG5vdD8iLCJjcmVhdGVkIjoxNTk1NTc2MTU5NDA1fS
wiTFB2VXREUTVPZWxrOHlDNSI6eyJkaXNjdXNzaW9uSWQiOiJK
NmlySHJFdVVsUmlNUjBlIiwic3ViIjoiZ2g6NTExMTI2MTgiLC
J0ZXh0IjoiT3IgaXMgdGhpcyBjb250YWluZWQgaW4gdGhlIHRp
bWVzdGFtcCBjaGVjayBpbiAxLTM/IiwiY3JlYXRlZCI6MTU5NT
U3NjI5NjI1Nn0sImszWERYVVJoMXl0NWk3d1ciOnsiZGlzY3Vz
c2lvbklkIjoialN3Zk9jbVozQnVhanJvUyIsInN1YiI6ImdoOj
UxMTEyNjE4IiwidGV4dCI6ImRvbiB0IHVuZGVyc3RhbmQ/IElz
IHRoaXMgZ2V0VGlwIGZvciBuZXcgbWVzc2FnZS5JRD8iLCJjcm
VhdGVkIjoxNTk1NTc2OTIzNjI4fSwiNVh2c1NMejBxbkd0ZmFx
YiI6eyJkaXNjdXNzaW9uSWQiOiJtZUNFSXBaNXhMTUt1Y2dNIi
wic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ijoid2hlcmUgaXMg
dGhpcyBkZWZpbmVkPyIsImNyZWF0ZWQiOjE1OTU1NzcxODEyNT
l9LCJ3ZXRPNkZBT2FkYlk0WmVlIjp7ImRpc2N1c3Npb25JZCI6
IkRPb2w3SklYT09iTEV0WEYiLCJzdWIiOiJnaDo1MTExMjYxOC
IsInRleHQiOiJUaGlzIHNob3VsZCBiZSBjYWxjdWxhYmxlLiBV
bmRlciBzb21lIGFzc3VtcHRpb25zIG9mIG1hbGljaW91cyBtcH
MgYW5kIGhvbmVzdCBtcHMgZXZlbiB0aGVvcmV0aWNhbGx5LiIs
ImNyZWF0ZWQiOjE1OTU1Nzc2MzE3NTZ9LCJsandvU3M3QU9aVT
RlRzNxIjp7ImRpc2N1c3Npb25JZCI6IktVVVBXbkgzMTBZUFA2
bkQiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJJcyB0aG
lzIHRoZSBkZWZpbml0aW9uIG9mIGNvbmZpZGVuY2UgbGV2ZWw/
IiwiY3JlYXRlZCI6MTU5NTU3Nzk2NTMzMX0sImVLQ0lFb1N3Mj
hxcFVLWE4iOnsiZGlzY3Vzc2lvbklkIjoiZzJNRng5Y0Jab2hT
RXdRZSIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IndoZX
JlIGlzIHRoaXMgZGVmaW5lZD8iLCJjcmVhdGVkIjoxNTk1NTc4
MDI4NzAxfSwiRFRxZGhBMThoMXdwUndudSI6eyJkaXNjdXNzaW
9uSWQiOiJlY1JUMHVnNE9MVXVaemNjIiwic3ViIjoiZ2g6NTEx
MTI2MTgiLCJ0ZXh0IjoiaXMgdGhlcmUgYSBjaGFuY2UgdGhhdC
BhIG1lc3NhZ2UgZ2V0cyB0cmFwcGVkIGluIHRoZSBNZXNzYWdl
IEluYm94IGFuZCBoYXMgdG8gYmUgcmVtb3ZlZCB0b28/IiwiY3
JlYXRlZCI6MTU5NTU3ODQ4ODU1MX0sImJlbzk0d3VjV1ppTEdh
SloiOnsiZGlzY3Vzc2lvbklkIjoiQ05zWEJ2QTNEejhJZzZYaS
IsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IldoYXQgaGFw
cGVucyBpZiBlbGlnaWJsZVRpcHNMaXN0IGlzIGVtcHR5IGZvci
BhbGwgbm9kZXM/IFNob3VsZCBudCB3ZSB0aGluayBhYm91dCBo
YW5kbGluZyB0aGlzIGNhc2U/IiwiY3JlYXRlZCI6MTU5NTU3OD
YzMTEzNn0sInJHVHIxVkYwbUZRY2pkMjgiOnsiZGlzY3Vzc2lv
bklkIjoiTFJzdUxwS2NvMjBUbFRlMyIsInN1YiI6ImdoOjY4Mj
UwMzUwIiwidGV4dCI6IlVzdWFsbHkgU2VyZ3VlaSBzYXlzIFwi
UHV0IGFueSByZWFzb25hYmxlIGluaXRpYWwgcGFyYW1ldGVyIG
FuZCB3ZSBjaGFuZ2UgYWZ0ZXIgdGVzdGluZ1wiLiIsImNyZWF0
ZWQiOjE1OTU4NzkzNzc3MDB9LCJlN0pZWkRpUHBrM0d4akFlIj
p7ImRpc2N1c3Npb25JZCI6Iko2aXJIckV1VWxSaU1SMGUiLCJz
dWIiOiJnaDo2ODI1MDM1MCIsInRleHQiOiJGcm9tIHRoZSBsYX
N0IGRpc2N1c3Npb24gZnJvbSB0aGUgZ3JvdXAsIEJNRCBjaGVj
ayBpcyBwYXJ0IG9mIHNvbGlkaWZpY2F0aW9uLCBwZWhhcHMgd2
UgbmVlZCB0byBjaGFuZ2Ugc2Vzc2lvbnMgdG8gcmVmbGVjdCB0
aGlzPyBJIHdpbGwgZGlzY3VzcyB0aGlzIGluIHRoZSBwcm90b2
NvbCBjYWxsIHRvbW9ycm93ISIsImNyZWF0ZWQiOjE1OTU4Nzk3
MDIzNzJ9LCJqMnFqb0thNTVvQkE2MzlzIjp7ImRpc2N1c3Npb2
5JZCI6IlJLcTlla211VWtVd0h4ZXUiLCJzdWIiOiJnaDo2ODI1
MDM1MCIsInRleHQiOiJSZXBlYXRlZCBcIk1vcmVvdmVyXCIsIH
VzZSBvdGhlciB3b3JkIGxpa2UgXCJBZGRpdGlvbmFsbHlcIiIs
ImNyZWF0ZWQiOjE1OTU4ODAwNDI1NjF9LCJFUjRtS0JwRTdNYT
JUNTZlIjp7ImRpc2N1c3Npb25JZCI6ImxCdmd0YkdhQlR2ZlZT
WWciLCJzdWIiOiJnaDo2ODI1MDM1MCIsInRleHQiOiJJT1RBIi
wiY3JlYXRlZCI6MTU5NTg4MDA3NDI1M30sIkxaNHJrWkZUYzd4
Zkk2OVIiOnsiZGlzY3Vzc2lvbklkIjoiVXNQbFpFMVhBdXMwN1
NMMCIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4dCI6IklzIGl0
IG9rIHRvIHVzZSB0aGUgbWF0aGVtYXRpY2FsIHRlcm1pbm9sb2
d5IGhlcmU/IiwiY3JlYXRlZCI6MTU5NTg4MDc0MDUwMX0sInB1
eUhEY2YyVWZWbmRyb0IiOnsiZGlzY3Vzc2lvbklkIjoiUEpCeH
dKZmFNQzBjMEs2aSIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4
dCI6IldlIG5lZWQgdG8gZGVmaW5lIGF0dGFja3Mgc29tZXdoZX
JlLiBBbHNvLCBkb2VzIGl0IG1ha2Ugc2Vuc2UgdG8gaGF2ZSBh
IGJsb3diYWxsIGF0dGFjayB3aXRoIG5vIG1pbGVzdG9uZXM/Ii
wiY3JlYXRlZCI6MTU5NTg4MDgwMzM4OH0sIk95RFB5c3JNSmNj
MGVuVm4iOnsiZGlzY3Vzc2lvbklkIjoiaVNhTUxtc002ZU1LQ2
p4SiIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4dCI6IkkgYmVs
aWV2ZSB3ZSBjYW4gYmUgcHJlY2lzZSBoZXJlIHdpdGggc29tZS
BtYXRoIGZyb20gVFMuLi4iLCJjcmVhdGVkIjoxNTk1ODgwODY4
MDQ5fSwidTZTcE9HZFlBOWp2Z25yRCI6eyJkaXNjdXNzaW9uSW
QiOiJ3Tkd3dDh0M2p4eDRrWlczIiwic3ViIjoiZ2g6NjgyNTAz
NTAiLCJ0ZXh0IjoiSXNuJ3QgY2hlY2tpbmcgcGFzdCBjb25lIG
p1c3QgYXMgZXhwZW5zaXZlPyIsImNyZWF0ZWQiOjE1OTU4ODA5
MTM4MTF9LCJ0THFETm9jTnRKMldPSkZGIjp7ImRpc2N1c3Npb2
5JZCI6ImdWRUpCNXVKSXBjRXhNM3MiLCJzdWIiOiJnaDo2ODI1
MDM1MCIsInRleHQiOiJQZWhhcHMgYSBzZWN0aW9uIGRlc2NyaW
JpbmcgcG9zc2libGUgYXR0YWNrcyB3b3VsZCBtaWtlIHRoZSBm
aWxlIGNsZWFuZXIiLCJjcmVhdGVkIjoxNTk1ODgxMTExNTY3fS
wiUk1pME1yUVJKVHBFUkFnNCI6eyJkaXNjdXNzaW9uSWQiOiJH
TmJEN0poVXR4OWhjWHFTIiwic3ViIjoiZ2g6NjgyNTAzNTAiLC
J0ZXh0IjoiV2UgbmVlZCB0byBkZWZpbmUgdGhlIHRlcm0gXCJv
cnBoYW5hZ2VcIiBiZWZvcmUgdXNpbmcgaXQiLCJjcmVhdGVkIj
oxNTk1ODgxMzg1NTI0fSwibmdtaVJIT1BsTFlRMDZVbCI6eyJk
aXNjdXNzaW9uSWQiOiJucUY3Y2xjWDhQdnI5bmxVIiwic3ViIj
oiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiRm9sbG93aW5nIFNlYmFz
dGlhbnMgQ29tbWVudHMgSSB3b3VsZCBzdWdnZXN0IHRoaXMgc2
VjdGlvbiB0byBjb21lIGJlZm9yZSwgc2luY2Ugd2UgbWFueSB0
aW1lcyB0YWxrIGFib3V0IG9ycGhhbmFnZSBhbmQgZmluYWxpdH
kgYmVmb3JlLiIsImNyZWF0ZWQiOjE1OTU4ODIyMzgyNzB9LCI0
Y00yRThBZ0FsbDAzNDdiIjp7ImRpc2N1c3Npb25JZCI6IkdGem
N0RFFSeUZmenk5dngiLCJzdWIiOiJnaDo2ODI1MDM1MCIsInRl
eHQiOiJUaGlzIHNob3VsZCBpbmR1Y2UgYSBuZXcgcGFyYW1ldG
VyIiwiY3JlYXRlZCI6MTU5NTg5NzI0ODMwNn0sIlA2NW9Fc0FE
V29nTHZxa0UiOnsiZGlzY3Vzc2lvbklkIjoiNTI2dzEwQjlReE
w3ZEdZZiIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4dCI6Ildl
IGluaXRpYWxseSBpbnRyb2R1Y2VkIDQgZ3JhZGVzLCBzbyB3ZS
Bjb3VsZCBoYXZlIG9uZSBraW5kIG9mIGZpbmFsaXR5IGluIHNv
bWUgc2Vjb25kcyAodGhlIHNtYWxsIG5ldHdvcmsgZGVsYXkgd2
l0aCBubyBjb25mbGljdHMpLCBJIGZlZWwgbGlrZSBjaGFuZ2lu
ZyBpdCBpcyBiYWQgZm9yIFBSLiIsImNyZWF0ZWQiOjE1OTU4OT
c5ODM4MzB9fSwiaGlzdG9yeSI6WzE0Njk2MTI3MTEsLTM5MjU4
NjIxMCwtNzg5NTMzMzYyLC03MDU3MDA3NTIsLTIwMjYzNDg4OD
AsLTE0ODg2Mjc5NDgsMTgzMTcyMDA1MSwtMTg2MDExODg2Niwx
MDYzMTk1Njc3LDEzODMwMTQxNDUsMTU1NDQ4MzUwMywtNzYyMD
EyMTk5LC03NjI2MjY5NzIsNTc5MDU4NzQ5LDEzNzc4NzI4MDQs
LTI2MTQxNDA4NSwtMTM3NzkwODc2MywxMTg5MjE5NzIyLC05Nz
Y3NjU2MDQsLTQxMzMyMzIzN119
-->