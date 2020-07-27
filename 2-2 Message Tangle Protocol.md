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

RURTS is easy to implement, computationally inexpensive, and minimizes orphanage. Moreover, it is in weak Nash equilibrium: honest users have nothing to gain by deviating from the protocol. Moreover, this tip selection algorithm should be resistant to blow ball attacks.  

As demonstrated in the original Iota white paper and subsequent simulations, URTS has no orphans.  Theoretically, RURTS should largely approximate URTS.  The only difference is that some tips may "expire" when they become older than `Delta`.  With a large `Delta`, honest messages will essentially never be orphaned. 

A message disliked by FPC will not be added to `eligibleTipsList` and thus will be orphaned.  Moreover, a message will be orphaned if some message in its past cone is disliked by FPC.  In this way, the algorithms enforce monotonicity in FPC voting, without traversing the tangle marking flags.

Since messages with questionable timestamps will not be flagged eligible until FPC resolves their status, honest messages should not approve them.  Thus, an attacker cannot trick honest messages into being orphaned.

It is necessary that `Delta>w+D` in order to prevent the following attack.  Suppose `w=30`, `D=5`, and `Delta=5`.  Given these parameters, an attacker can maintain a chain of messages whose tip always has a timestamp between `currentTime-10` and `currentTime-15`,   because the timestamps in this interval will always be valid. However, the confirmation confidence of every message in this chain will always be `0` because each message is older than `Delta`.  At anytime, the attacker can orphan the entire chain by ceasing issueing messages, but the attacker can also  have the chain reach full confirmation confidence by issueing tips with current timestamps. Thus the status of this chain is indeterminable: the messages are neither "in" nor "out" of the ledger.  This is effectively a liveness attack.  

To summarize, bad messages will be orphaned, and honest messages will not.  Moreover, we claim that there is no middle ground: regardless of an attacker's actions, all messages flagged as eligible will not be orphaned, with high probability.   Indeed, `Delta` will be set significantly greater than `w+D`, thus any message added to the eligible tip list will be eligible for tip selection long enough that it will be eventually selected with high probability.  


### Alternatives

Tips in the eligible tip list might expire, although this should not happen very often given the discussion above. Such tips will be removed from `eligibleTipList` during snapshotting.  However, to optimize efficiency, a node may want to occasionally clean the `eligibleTipList` of expired tips.

Similarly, the `pending` list can be regularly cleaned of messages which will never become eligible.  Indeed, if any message directly references a messagse with `opinion=FaLSE`  or `level` 2 or 3, that message can be eliminated from the pending list.  However, if they are not, they will be scrubbed from the pending list during the snapshot.  

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

A message is "final" if we are sure that it wont be orphaned. Recall that we call a message is orphaned if it is not indirectly referenced by any eligible tips. Unfortunately, finality can never be definitively determined: we can only describe conditions where the probability of orphanage is low. Each of these grades are examples of such conditions. 

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
B3ZSBkbyBub+KApiIsInN0YXJ0IjoxMTE5NSwiZW5kIjoxMTMy
NX0sIktVVVBXbkgzMTBZUFA2bkQiOnsidGV4dCI6ImNvbmZpcm
1hdGlvbkNvbmZpZGVuYyIsInN0YXJ0IjoxMjY2MiwiZW5kIjox
MjY4M30sImcyTUZ4OWNCWm9oU0V3UWUiOnsidGV4dCI6IlJlY2
FsbCB0Iiwic3RhcnQiOjEzMDMwLCJlbmQiOjEzMDM4fSwiZWNS
VDB1ZzRPTFV1WnpjYyI6eyJ0ZXh0IjoiaGUgZm9sbG93aW5nIi
wic3RhcnQiOjE1MTM0LCJlbmQiOjE1MTQ2fSwiQ05zWEJ2QTNE
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
NSwidGV4dCI6ImZvbGxvd2luZyBhdHRhY2sifX0sImNvbW1lbn
RzIjp7IlhXQzdyQ1dXdTlzRTNSOHYiOnsiZGlzY3Vzc2lvbklk
Ijoia2tFb2dWaHhwT2taVnJXRSIsInN1YiI6ImdoOjUxMTEyNj
E4IiwidGV4dCI6IlRoaXMgaXMgYSBzdHJvbmcgYXNzdW1wdGlv
biBhbmQgbWF5IGJlIGludGVycHJldGVkIGluIGEgd3Jvbmcgd2
F5LiBXaGF0IGhhcHBlbnMgb2Ygb25lIG1lc3NhZ2UgaXMgbm90
IGRlbGl2ZXJlZCBvbiB0aW1lPyBQcm90b2NvbCBicmVha3M/Ii
wiY3JlYXRlZCI6MTU5NTU3MjYyNDkzM30sIkljOXNmd3lWcDl4
dlJYZkkiOnsiZGlzY3Vzc2lvbklkIjoiTVJNamVyamh5NGJZR0
VrbyIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IklzIHRo
aXMgdGhlIE1lc3NhZ2UgSW5ib3ggZnJvbSAxLTMgPyIsImNyZW
F0ZWQiOjE1OTU1NzI3NTUzNjF9LCJBUWcybWlyNnVYcENPSTE2
Ijp7ImRpc2N1c3Npb25JZCI6Ik1STWplcmpoeTRiWUdFa28iLC
JzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJQcm9iYWJseSBv
bmx5IHRoZSBzdWJzZXQgdGhhdCBpcyBub24tZWxpZ2libGUuIi
wiY3JlYXRlZCI6MTU5NTU3Mjc5MzY5M30sIkZZWFVXN1VPWTVl
b3NKQmoiOnsiZGlzY3Vzc2lvbklkIjoiWEhXdG1xOW4wbGNVUE
h5biIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Im1lc3Nh
Z2VJRD8iLCJjcmVhdGVkIjoxNTk1NTcyOTg2ODE3fSwiYXlUWm
tQazdyWXROYkFaQyI6eyJkaXNjdXNzaW9uSWQiOiJsV01EYWk0
V2xDOUd2cGVxIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ij
oibm90IGNsZWFyIHdpdGhvdXQga25vd2luZyB3aGF0IGl0IGlz
IGFscmVhZHkiLCJjcmVhdGVkIjoxNTk1NTczNDQwMjUzfSwiQW
dGTk5YSGtxTUxnVzUzayI6eyJkaXNjdXNzaW9uSWQiOiJIcWRX
V0RUUGt4TzJvdHVaIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZX
h0IjoiZG9uIHQgdW5kZXJzdGFuZCIsImNyZWF0ZWQiOjE1OTU1
NzM0NzkxMDh9LCJlNm1UVzNBUFZ6RU5FUk5wIjp7ImRpc2N1c3
Npb25JZCI6ImFZWExtN0VDOXoyTEpUeE4iLCJzdWIiOiJnaDo1
MTExMjYxOCIsInRleHQiOiJJIHN1Z2dlc3QgdG8gYWx3eWFzIH
dyaXRlIFwibG9jYWwgdGltZVwiIGlmIGl0IGlzIHRoZSBsb2Nh
bCB0aW1lIG9mIGEgcGFydGljdWxhciBub2RlIiwiY3JlYXRlZC
I6MTU5NTU3Mzc3OTMxOX0sIkJZTlB1dURaVUxKVVI2QWUiOnsi
ZGlzY3Vzc2lvbklkIjoiaE5DS1REZGUzOGF1NVl1dSIsInN1Yi
I6ImdoOjUxMTEyNjE4IiwidGV4dCI6IlN0cmljdGx5IHNwZWFr
aW5nIHRoaXMgaXMgbm90IGEgdGltZSwgbW9yZSBhIHBvaW50IG
luIHRpbWUgKHdlIGJlbGlldmUgdG8gbGl2ZSBpbikuIFVOSVgt
dGltZT8iLCJjcmVhdGVkIjoxNTk1NTc0NTMyODczfSwiWlB2dW
9GTGdWclVtWDJiRyI6eyJkaXNjdXNzaW9uSWQiOiJZWk9nN3pj
MXJiT0dmbGRaIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ij
oid2hlcmUgd2lsbCB0aGV5IGJlIHN0b3JlZD8iLCJjcmVhdGVk
IjoxNTk1NTc0NjM2NTc5fSwiS2k2bWRpb1BTR2lPS2pzVyI6ey
JkaXNjdXNzaW9uSWQiOiI4Wm1DRXNpaHpYSkZNOTEyIiwic3Vi
IjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoibWFrZSBjb25zaXN0ZW
50OyBzdGFydCB1cHBlciBvciBsb3dlciBjYXNlIGFmdGVyICcg
Jywgb3IgdXNlIDogPyIsImNyZWF0ZWQiOjE1OTU1NzQ3NjcwNT
l9LCJxM09ROUJvZ280OGhVNFRwIjp7ImRpc2N1c3Npb25JZCI6
IjhabUNFc2loelhKRk05MTIiLCJzdWIiOiJnaDo1MTExMjYxOC
IsInRleHQiOiJ1c2UgdGhlIHNhbWUgdGhyb3VnaG91dCB0aGUg
c3BlY3MiLCJjcmVhdGVkIjoxNTk1NTc0ODEyNzE2fSwidllqMz
RVekhGdE91a0hzSCI6eyJkaXNjdXNzaW9uSWQiOiJPcVlkcllz
eWFyYkhvWUVnIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ij
oiY3VycmVudCBsb2NhbCB0aW1lPyIsImNyZWF0ZWQiOjE1OTU1
NzUwMDkyNjV9LCJhYVI1M1JiWmpyYU5RaGpvIjp7ImRpc2N1c3
Npb25JZCI6Ik9xWWRyWXN5YXJiSG9ZRWciLCJzdWIiOiJnaDo1
MTExMjYxOCIsInRleHQiOiJpZiBpdCByZWZlcnMgdG8gdGhlIH
ZhcmlhYmxlIGBjdXJyZW50IHRpbWVgYWRkIHRoZXNlIGBzIiwi
Y3JlYXRlZCI6MTU5NTU3NTA4NjM5OX0sInZLR0FFYzdFZDNETD
NDNXMiOnsiZGlzY3Vzc2lvbklkIjoiTFJzdUxwS2NvMjBUbFRl
MyIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IkJUVyB3aG
VyZSBpcyBpdCBzcGVjaWZpZWQgaG93IHRvIGNob29zZSB3IGFu
ZCB0aGUgb3RoZXIgcGFyYW1ldGVycz8iLCJjcmVhdGVkIjoxNT
k1NTc1MTQzNDM3fSwiVHAzUHhZVW1OOERwdXZlayI6eyJkaXNj
dXNzaW9uSWQiOiJmUmdzRlpuclRjZmUyNGIzIiwic3ViIjoiZ2
g6NTExMTI2MTgiLCJ0ZXh0IjoiSXMgdGhpcyBhZnRlciB0aGUg
bWVzc2FnZSBwYXNzZWQgdGhlIHJhdGUgbWFuYWdlcj8gSWYgeW
VzLCBJIG0gYSBiaXQgY29uZnVzZWQsIG5vZGUgd2l0aCBkaWZm
ZXJlbnQgbWFuYSBwZXJjZXB0aW9uIG1pZ2h0IGhhbmRsZSB0aG
UgbWVzc2FnZSBkaWZmZXJlbnRseSIsImNyZWF0ZWQiOjE1OTU1
NzU1NjMxNzB9LCJWNGRLYmZ3UTdQWEJGSWM2Ijp7ImRpc2N1c3
Npb25JZCI6Iko2aXJIckV1VWxSaU1SMGUiLCJzdWIiOiJnaDo1
MTExMjYxOCIsInRleHQiOiJEb2VzIHRoaXMgY29tZSBiZWZvcm
UgdGhlIGFib3ZlIHN0ZXAgb3IgYWZ0ZXI/IEEgZ3JhcGggbGlr
ZSBpbiAxLTMgc2hvd2luZyB0aGUgcHJvY2Vzc2VzIG1pZ2h0IG
JlIGdvb2QiLCJjcmVhdGVkIjoxNTk1NTc2MTI1NzMxfSwidzJx
VThERFhDc1JndGRGSCI6eyJkaXNjdXNzaW9uSWQiOiI3Q1Fadj
NZRnFpYnh4UHNVIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0
IjoiZnJvbSB3aGVyZT8gTWVzc2FnZSBJbmJveD8gU3RpbGwgZ2
9zc2lwZWQgb3Igbm90PyIsImNyZWF0ZWQiOjE1OTU1NzYxNTk0
MDV9LCJMUHZVdERRNU9lbGs4eUM1Ijp7ImRpc2N1c3Npb25JZC
I6Iko2aXJIckV1VWxSaU1SMGUiLCJzdWIiOiJnaDo1MTExMjYx
OCIsInRleHQiOiJPciBpcyB0aGlzIGNvbnRhaW5lZCBpbiB0aG
UgdGltZXN0YW1wIGNoZWNrIGluIDEtMz8iLCJjcmVhdGVkIjox
NTk1NTc2Mjk2MjU2fSwiazNYRFhVUmgxeXQ1aTd3VyI6eyJkaX
NjdXNzaW9uSWQiOiJqU3dmT2NtWjNCdWFqcm9TIiwic3ViIjoi
Z2g6NTExMTI2MTgiLCJ0ZXh0IjoiZG9uIHQgdW5kZXJzdGFuZD
8gSXMgdGhpcyBnZXRUaXAgZm9yIG5ldyBtZXNzYWdlLklEPyIs
ImNyZWF0ZWQiOjE1OTU1NzY5MjM2Mjh9LCI1WHZzU0x6MHFuR3
RmYXFiIjp7ImRpc2N1c3Npb25JZCI6Im1lQ0VJcFo1eExNS3Vj
Z00iLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJ3aGVyZS
BpcyB0aGlzIGRlZmluZWQ/IiwiY3JlYXRlZCI6MTU5NTU3NzE4
MTI1OX0sIndldE82RkFPYWRiWTRaZWUiOnsiZGlzY3Vzc2lvbk
lkIjoiRE9vbDdKSVhPT2JMRXRYRiIsInN1YiI6ImdoOjUxMTEy
NjE4IiwidGV4dCI6IlRoaXMgc2hvdWxkIGJlIGNhbGN1bGFibG
UuIFVuZGVyIHNvbWUgYXNzdW1wdGlvbnMgb2YgbWFsaWNpb3Vz
IG1wcyBhbmQgaG9uZXN0IG1wcyBldmVuIHRoZW9yZXRpY2FsbH
kuIiwiY3JlYXRlZCI6MTU5NTU3NzYzMTc1Nn0sImxqd29TczdB
T1pVNGVHM3EiOnsiZGlzY3Vzc2lvbklkIjoiS1VVUFduSDMxMF
lQUDZuRCIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Iklz
IHRoaXMgdGhlIGRlZmluaXRpb24gb2YgY29uZmlkZW5jZSBsZX
ZlbD8iLCJjcmVhdGVkIjoxNTk1NTc3OTY1MzMxfSwiZUtDSUVv
U3cyOHFwVUtYTiI6eyJkaXNjdXNzaW9uSWQiOiJnMk1GeDljQl
pvaFNFd1FlIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ijoi
d2hlcmUgaXMgdGhpcyBkZWZpbmVkPyIsImNyZWF0ZWQiOjE1OT
U1NzgwMjg3MDF9LCJEVHFkaEExOGgxd3BSd251Ijp7ImRpc2N1
c3Npb25JZCI6ImVjUlQwdWc0T0xVdVp6Y2MiLCJzdWIiOiJnaD
o1MTExMjYxOCIsInRleHQiOiJpcyB0aGVyZSBhIGNoYW5jZSB0
aGF0IGEgbWVzc2FnZSBnZXRzIHRyYXBwZWQgaW4gdGhlIE1lc3
NhZ2UgSW5ib3ggYW5kIGhhcyB0byBiZSByZW1vdmVkIHRvbz8i
LCJjcmVhdGVkIjoxNTk1NTc4NDg4NTUxfSwiYmVvOTR3dWNXWm
lMR2FKWiI6eyJkaXNjdXNzaW9uSWQiOiJDTnNYQnZBM0R6OEln
NlhpIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiV2hhdC
BoYXBwZW5zIGlmIGVsaWdpYmxlVGlwc0xpc3QgaXMgZW1wdHkg
Zm9yIGFsbCBub2Rlcz8gU2hvdWxkIG50IHdlIHRoaW5rIGFib3
V0IGhhbmRsaW5nIHRoaXMgY2FzZT8iLCJjcmVhdGVkIjoxNTk1
NTc4NjMxMTM2fSwickdUcjFWRjBtRlFjamQyOCI6eyJkaXNjdX
NzaW9uSWQiOiJMUnN1THBLY28yMFRsVGUzIiwic3ViIjoiZ2g6
NjgyNTAzNTAiLCJ0ZXh0IjoiVXN1YWxseSBTZXJndWVpIHNheX
MgXCJQdXQgYW55IHJlYXNvbmFibGUgaW5pdGlhbCBwYXJhbWV0
ZXIgYW5kIHdlIGNoYW5nZSBhZnRlciB0ZXN0aW5nXCIuIiwiY3
JlYXRlZCI6MTU5NTg3OTM3NzcwMH0sImU3SllaRGlQcGszR3hq
QWUiOnsiZGlzY3Vzc2lvbklkIjoiSjZpckhyRXVVbFJpTVIwZS
IsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4dCI6IkZyb20gdGhl
IGxhc3QgZGlzY3Vzc2lvbiBmcm9tIHRoZSBncm91cCwgQk1EIG
NoZWNrIGlzIHBhcnQgb2Ygc29saWRpZmljYXRpb24sIHBlaGFw
cyB3ZSBuZWVkIHRvIGNoYW5nZSBzZXNzaW9ucyB0byByZWZsZW
N0IHRoaXM/IEkgd2lsbCBkaXNjdXNzIHRoaXMgaW4gdGhlIHBy
b3RvY29sIGNhbGwgdG9tb3Jyb3chIiwiY3JlYXRlZCI6MTU5NT
g3OTcwMjM3Mn0sImoycWpvS2E1NW9CQTYzOXMiOnsiZGlzY3Vz
c2lvbklkIjoiUktxOWVrbXVVa1V3SHhldSIsInN1YiI6ImdoOj
Y4MjUwMzUwIiwidGV4dCI6IlJlcGVhdGVkIFwiTW9yZW92ZXJc
IiwgdXNlIG90aGVyIHdvcmQgbGlrZSBcIkFkZGl0aW9uYWxseV
wiIiwiY3JlYXRlZCI6MTU5NTg4MDA0MjU2MX0sIkVSNG1LQnBF
N01hMlQ1NmUiOnsiZGlzY3Vzc2lvbklkIjoibEJ2Z3RiR2FCVH
ZmVlNZZyIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4dCI6IklP
VEEiLCJjcmVhdGVkIjoxNTk1ODgwMDc0MjUzfSwiTFo0cmtaRl
RjN3hmSTY5UiI6eyJkaXNjdXNzaW9uSWQiOiJVc1BsWkUxWEF1
czA3U0wwIiwic3ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiSX
MgaXQgb2sgdG8gdXNlIHRoZSBtYXRoZW1hdGljYWwgdGVybWlu
b2xvZ3kgaGVyZT8iLCJjcmVhdGVkIjoxNTk1ODgwNzQwNTAxfS
wicHV5SERjZjJVZlZuZHJvQiI6eyJkaXNjdXNzaW9uSWQiOiJQ
SkJ4d0pmYU1DMGMwSzZpIiwic3ViIjoiZ2g6NjgyNTAzNTAiLC
J0ZXh0IjoiV2UgbmVlZCB0byBkZWZpbmUgYXR0YWNrcyBzb21l
d2hlcmUuIEFsc28sIGRvZXMgaXQgbWFrZSBzZW5zZSB0byBoYX
ZlIGEgYmxvd2JhbGwgYXR0YWNrIHdpdGggbm8gbWlsZXN0b25l
cz8iLCJjcmVhdGVkIjoxNTk1ODgwODAzMzg4fSwiT3lEUHlzck
1KY2MwZW5WbiI6eyJkaXNjdXNzaW9uSWQiOiJpU2FNTG1zTTZl
TUtDanhKIiwic3ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiSS
BiZWxpZXZlIHdlIGNhbiBiZSBwcmVjaXNlIGhlcmUgd2l0aCBz
b21lIG1hdGggZnJvbSBUUy4uLiIsImNyZWF0ZWQiOjE1OTU4OD
A4NjgwNDl9LCJ1NlNwT0dkWUE5anZnbnJEIjp7ImRpc2N1c3Np
b25JZCI6IndOR3d0OHQzanh4NGtaVzMiLCJzdWIiOiJnaDo2OD
I1MDM1MCIsInRleHQiOiJJc24ndCBjaGVja2luZyBwYXN0IGNv
bmUganVzdCBhcyBleHBlbnNpdmU/IiwiY3JlYXRlZCI6MTU5NT
g4MDkxMzgxMX0sInRMcUROb2NOdEoyV09KRkYiOnsiZGlzY3Vz
c2lvbklkIjoiZ1ZFSkI1dUpJcGNFeE0zcyIsInN1YiI6ImdoOj
Y4MjUwMzUwIiwidGV4dCI6IlBlaGFwcyBhIHNlY3Rpb24gZGVz
Y3JpYmluZyBwb3NzaWJsZSBhdHRhY2tzIHdvdWxkIG1pa2UgdG
hlIGZpbGUgY2xlYW5lciIsImNyZWF0ZWQiOjE1OTU4ODExMTE1
Njd9fSwiaGlzdG9yeSI6Wy0yMDI2MzQ4ODgwLC0xNDg4NjI3OT
Q4LDE4MzE3MjAwNTEsLTE4NjAxMTg4NjYsMTA2MzE5NTY3Nywx
MzgzMDE0MTQ1LDE1NTQ0ODM1MDMsLTc2MjAxMjE5OSwtNzYyNj
I2OTcyLDU3OTA1ODc0OSwxMzc3ODcyODA0LC0yNjE0MTQwODUs
LTEzNzc5MDg3NjMsMTE4OTIxOTcyMiwtOTc2NzY1NjA0LC00MT
MzMjMyMzcsNjYxNDQ3NDU5LC0xMDgxMjk1MTc2LC0xNDg3MDY4
MDAwLDgxMzU4NTg2NF19
-->