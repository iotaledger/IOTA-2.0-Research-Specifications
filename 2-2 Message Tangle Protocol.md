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
Ojc0MzMsImVuZCI6NzQzNywidGV4dCI6IklvdGEifX0sImNvbW
1lbnRzIjp7IlhXQzdyQ1dXdTlzRTNSOHYiOnsiZGlzY3Vzc2lv
bklkIjoia2tFb2dWaHhwT2taVnJXRSIsInN1YiI6ImdoOjUxMT
EyNjE4IiwidGV4dCI6IlRoaXMgaXMgYSBzdHJvbmcgYXNzdW1w
dGlvbiBhbmQgbWF5IGJlIGludGVycHJldGVkIGluIGEgd3Jvbm
cgd2F5LiBXaGF0IGhhcHBlbnMgb2Ygb25lIG1lc3NhZ2UgaXMg
bm90IGRlbGl2ZXJlZCBvbiB0aW1lPyBQcm90b2NvbCBicmVha3
M/IiwiY3JlYXRlZCI6MTU5NTU3MjYyNDkzM30sIkljOXNmd3lW
cDl4dlJYZkkiOnsiZGlzY3Vzc2lvbklkIjoiTVJNamVyamh5NG
JZR0VrbyIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Iklz
IHRoaXMgdGhlIE1lc3NhZ2UgSW5ib3ggZnJvbSAxLTMgPyIsIm
NyZWF0ZWQiOjE1OTU1NzI3NTUzNjF9LCJBUWcybWlyNnVYcENP
STE2Ijp7ImRpc2N1c3Npb25JZCI6Ik1STWplcmpoeTRiWUdFa2
8iLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJQcm9iYWJs
eSBvbmx5IHRoZSBzdWJzZXQgdGhhdCBpcyBub24tZWxpZ2libG
UuIiwiY3JlYXRlZCI6MTU5NTU3Mjc5MzY5M30sIkZZWFVXN1VP
WTVlb3NKQmoiOnsiZGlzY3Vzc2lvbklkIjoiWEhXdG1xOW4wbG
NVUEh5biIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Im1l
c3NhZ2VJRD8iLCJjcmVhdGVkIjoxNTk1NTcyOTg2ODE3fSwiYX
lUWmtQazdyWXROYkFaQyI6eyJkaXNjdXNzaW9uSWQiOiJsV01E
YWk0V2xDOUd2cGVxIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZX
h0Ijoibm90IGNsZWFyIHdpdGhvdXQga25vd2luZyB3aGF0IGl0
IGlzIGFscmVhZHkiLCJjcmVhdGVkIjoxNTk1NTczNDQwMjUzfS
wiQWdGTk5YSGtxTUxnVzUzayI6eyJkaXNjdXNzaW9uSWQiOiJI
cWRXV0RUUGt4TzJvdHVaIiwic3ViIjoiZ2g6NTExMTI2MTgiLC
J0ZXh0IjoiZG9uIHQgdW5kZXJzdGFuZCIsImNyZWF0ZWQiOjE1
OTU1NzM0NzkxMDh9LCJlNm1UVzNBUFZ6RU5FUk5wIjp7ImRpc2
N1c3Npb25JZCI6ImFZWExtN0VDOXoyTEpUeE4iLCJzdWIiOiJn
aDo1MTExMjYxOCIsInRleHQiOiJJIHN1Z2dlc3QgdG8gYWx3eW
FzIHdyaXRlIFwibG9jYWwgdGltZVwiIGlmIGl0IGlzIHRoZSBs
b2NhbCB0aW1lIG9mIGEgcGFydGljdWxhciBub2RlIiwiY3JlYX
RlZCI6MTU5NTU3Mzc3OTMxOX0sIkJZTlB1dURaVUxKVVI2QWUi
OnsiZGlzY3Vzc2lvbklkIjoiaE5DS1REZGUzOGF1NVl1dSIsIn
N1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IlN0cmljdGx5IHNw
ZWFraW5nIHRoaXMgaXMgbm90IGEgdGltZSwgbW9yZSBhIHBvaW
50IGluIHRpbWUgKHdlIGJlbGlldmUgdG8gbGl2ZSBpbikuIFVO
SVgtdGltZT8iLCJjcmVhdGVkIjoxNTk1NTc0NTMyODczfSwiWl
B2dW9GTGdWclVtWDJiRyI6eyJkaXNjdXNzaW9uSWQiOiJZWk9n
N3pjMXJiT0dmbGRaIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZX
h0Ijoid2hlcmUgd2lsbCB0aGV5IGJlIHN0b3JlZD8iLCJjcmVh
dGVkIjoxNTk1NTc0NjM2NTc5fSwiS2k2bWRpb1BTR2lPS2pzVy
I6eyJkaXNjdXNzaW9uSWQiOiI4Wm1DRXNpaHpYSkZNOTEyIiwi
c3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoibWFrZSBjb25zaX
N0ZW50OyBzdGFydCB1cHBlciBvciBsb3dlciBjYXNlIGFmdGVy
ICcgJywgb3IgdXNlIDogPyIsImNyZWF0ZWQiOjE1OTU1NzQ3Nj
cwNTl9LCJxM09ROUJvZ280OGhVNFRwIjp7ImRpc2N1c3Npb25J
ZCI6IjhabUNFc2loelhKRk05MTIiLCJzdWIiOiJnaDo1MTExMj
YxOCIsInRleHQiOiJ1c2UgdGhlIHNhbWUgdGhyb3VnaG91dCB0
aGUgc3BlY3MiLCJjcmVhdGVkIjoxNTk1NTc0ODEyNzE2fSwidl
lqMzRVekhGdE91a0hzSCI6eyJkaXNjdXNzaW9uSWQiOiJPcVlk
cllzeWFyYkhvWUVnIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZX
h0IjoiY3VycmVudCBsb2NhbCB0aW1lPyIsImNyZWF0ZWQiOjE1
OTU1NzUwMDkyNjV9LCJhYVI1M1JiWmpyYU5RaGpvIjp7ImRpc2
N1c3Npb25JZCI6Ik9xWWRyWXN5YXJiSG9ZRWciLCJzdWIiOiJn
aDo1MTExMjYxOCIsInRleHQiOiJpZiBpdCByZWZlcnMgdG8gdG
hlIHZhcmlhYmxlIGBjdXJyZW50IHRpbWVgYWRkIHRoZXNlIGBz
IiwiY3JlYXRlZCI6MTU5NTU3NTA4NjM5OX0sInZLR0FFYzdFZD
NETDNDNXMiOnsiZGlzY3Vzc2lvbklkIjoiTFJzdUxwS2NvMjBU
bFRlMyIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IkJUVy
B3aGVyZSBpcyBpdCBzcGVjaWZpZWQgaG93IHRvIGNob29zZSB3
IGFuZCB0aGUgb3RoZXIgcGFyYW1ldGVycz8iLCJjcmVhdGVkIj
oxNTk1NTc1MTQzNDM3fSwiVHAzUHhZVW1OOERwdXZlayI6eyJk
aXNjdXNzaW9uSWQiOiJmUmdzRlpuclRjZmUyNGIzIiwic3ViIj
oiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiSXMgdGhpcyBhZnRlciB0
aGUgbWVzc2FnZSBwYXNzZWQgdGhlIHJhdGUgbWFuYWdlcj8gSW
YgeWVzLCBJIG0gYSBiaXQgY29uZnVzZWQsIG5vZGUgd2l0aCBk
aWZmZXJlbnQgbWFuYSBwZXJjZXB0aW9uIG1pZ2h0IGhhbmRsZS
B0aGUgbWVzc2FnZSBkaWZmZXJlbnRseSIsImNyZWF0ZWQiOjE1
OTU1NzU1NjMxNzB9LCJWNGRLYmZ3UTdQWEJGSWM2Ijp7ImRpc2
N1c3Npb25JZCI6Iko2aXJIckV1VWxSaU1SMGUiLCJzdWIiOiJn
aDo1MTExMjYxOCIsInRleHQiOiJEb2VzIHRoaXMgY29tZSBiZW
ZvcmUgdGhlIGFib3ZlIHN0ZXAgb3IgYWZ0ZXI/IEEgZ3JhcGgg
bGlrZSBpbiAxLTMgc2hvd2luZyB0aGUgcHJvY2Vzc2VzIG1pZ2
h0IGJlIGdvb2QiLCJjcmVhdGVkIjoxNTk1NTc2MTI1NzMxfSwi
dzJxVThERFhDc1JndGRGSCI6eyJkaXNjdXNzaW9uSWQiOiI3Q1
FadjNZRnFpYnh4UHNVIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0
ZXh0IjoiZnJvbSB3aGVyZT8gTWVzc2FnZSBJbmJveD8gU3RpbG
wgZ29zc2lwZWQgb3Igbm90PyIsImNyZWF0ZWQiOjE1OTU1NzYx
NTk0MDV9LCJMUHZVdERRNU9lbGs4eUM1Ijp7ImRpc2N1c3Npb2
5JZCI6Iko2aXJIckV1VWxSaU1SMGUiLCJzdWIiOiJnaDo1MTEx
MjYxOCIsInRleHQiOiJPciBpcyB0aGlzIGNvbnRhaW5lZCBpbi
B0aGUgdGltZXN0YW1wIGNoZWNrIGluIDEtMz8iLCJjcmVhdGVk
IjoxNTk1NTc2Mjk2MjU2fSwiazNYRFhVUmgxeXQ1aTd3VyI6ey
JkaXNjdXNzaW9uSWQiOiJqU3dmT2NtWjNCdWFqcm9TIiwic3Vi
IjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiZG9uIHQgdW5kZXJzdG
FuZD8gSXMgdGhpcyBnZXRUaXAgZm9yIG5ldyBtZXNzYWdlLklE
PyIsImNyZWF0ZWQiOjE1OTU1NzY5MjM2Mjh9LCI1WHZzU0x6MH
FuR3RmYXFiIjp7ImRpc2N1c3Npb25JZCI6Im1lQ0VJcFo1eExN
S3VjZ00iLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJ3aG
VyZSBpcyB0aGlzIGRlZmluZWQ/IiwiY3JlYXRlZCI6MTU5NTU3
NzE4MTI1OX0sIndldE82RkFPYWRiWTRaZWUiOnsiZGlzY3Vzc2
lvbklkIjoiRE9vbDdKSVhPT2JMRXRYRiIsInN1YiI6ImdoOjUx
MTEyNjE4IiwidGV4dCI6IlRoaXMgc2hvdWxkIGJlIGNhbGN1bG
FibGUuIFVuZGVyIHNvbWUgYXNzdW1wdGlvbnMgb2YgbWFsaWNp
b3VzIG1wcyBhbmQgaG9uZXN0IG1wcyBldmVuIHRoZW9yZXRpY2
FsbHkuIiwiY3JlYXRlZCI6MTU5NTU3NzYzMTc1Nn0sImxqd29T
czdBT1pVNGVHM3EiOnsiZGlzY3Vzc2lvbklkIjoiS1VVUFduSD
MxMFlQUDZuRCIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6
IklzIHRoaXMgdGhlIGRlZmluaXRpb24gb2YgY29uZmlkZW5jZS
BsZXZlbD8iLCJjcmVhdGVkIjoxNTk1NTc3OTY1MzMxfSwiZUtD
SUVvU3cyOHFwVUtYTiI6eyJkaXNjdXNzaW9uSWQiOiJnMk1GeD
ljQlpvaFNFd1FlIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0
Ijoid2hlcmUgaXMgdGhpcyBkZWZpbmVkPyIsImNyZWF0ZWQiOj
E1OTU1NzgwMjg3MDF9LCJEVHFkaEExOGgxd3BSd251Ijp7ImRp
c2N1c3Npb25JZCI6ImVjUlQwdWc0T0xVdVp6Y2MiLCJzdWIiOi
JnaDo1MTExMjYxOCIsInRleHQiOiJpcyB0aGVyZSBhIGNoYW5j
ZSB0aGF0IGEgbWVzc2FnZSBnZXRzIHRyYXBwZWQgaW4gdGhlIE
1lc3NhZ2UgSW5ib3ggYW5kIGhhcyB0byBiZSByZW1vdmVkIHRv
bz8iLCJjcmVhdGVkIjoxNTk1NTc4NDg4NTUxfSwiYmVvOTR3dW
NXWmlMR2FKWiI6eyJkaXNjdXNzaW9uSWQiOiJDTnNYQnZBM0R6
OElnNlhpIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiV2
hhdCBoYXBwZW5zIGlmIGVsaWdpYmxlVGlwc0xpc3QgaXMgZW1w
dHkgZm9yIGFsbCBub2Rlcz8gU2hvdWxkIG50IHdlIHRoaW5rIG
Fib3V0IGhhbmRsaW5nIHRoaXMgY2FzZT8iLCJjcmVhdGVkIjox
NTk1NTc4NjMxMTM2fSwickdUcjFWRjBtRlFjamQyOCI6eyJkaX
NjdXNzaW9uSWQiOiJMUnN1THBLY28yMFRsVGUzIiwic3ViIjoi
Z2g6NjgyNTAzNTAiLCJ0ZXh0IjoiVXN1YWxseSBTZXJndWVpIH
NheXMgXCJQdXQgYW55IHJlYXNvbmFibGUgaW5pdGlhbCBwYXJh
bWV0ZXIgYW5kIHdlIGNoYW5nZSBhZnRlciB0ZXN0aW5nXCIuIi
wiY3JlYXRlZCI6MTU5NTg3OTM3NzcwMH0sImU3SllaRGlQcGsz
R3hqQWUiOnsiZGlzY3Vzc2lvbklkIjoiSjZpckhyRXVVbFJpTV
IwZSIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4dCI6IkZyb20g
dGhlIGxhc3QgZGlzY3Vzc2lvbiBmcm9tIHRoZSBncm91cCwgQk
1EIGNoZWNrIGlzIHBhcnQgb2Ygc29saWRpZmljYXRpb24sIHBl
aGFwcyB3ZSBuZWVkIHRvIGNoYW5nZSBzZXNzaW9ucyB0byByZW
ZsZWN0IHRoaXM/IEkgd2lsbCBkaXNjdXNzIHRoaXMgaW4gdGhl
IHByb3RvY29sIGNhbGwgdG9tb3Jyb3chIiwiY3JlYXRlZCI6MT
U5NTg3OTcwMjM3Mn0sImoycWpvS2E1NW9CQTYzOXMiOnsiZGlz
Y3Vzc2lvbklkIjoiUktxOWVrbXVVa1V3SHhldSIsInN1YiI6Im
doOjY4MjUwMzUwIiwidGV4dCI6IlJlcGVhdGVkIFwiTW9yZW92
ZXJcIiwgdXNlIG90aGVyIHdvcmQgbGlrZSBcIkFkZGl0aW9uYW
xseVwiIiwiY3JlYXRlZCI6MTU5NTg4MDA0MjU2MX0sIkVSNG1L
QnBFN01hMlQ1NmUiOnsiZGlzY3Vzc2lvbklkIjoibEJ2Z3RiR2
FCVHZmVlNZZyIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4dCI6
IklPVEEiLCJjcmVhdGVkIjoxNTk1ODgwMDc0MjUzfX0sImhpc3
RvcnkiOlsxODMxNzIwMDUxLC0xODYwMTE4ODY2LDEwNjMxOTU2
NzcsMTM4MzAxNDE0NSwxNTU0NDgzNTAzLC03NjIwMTIxOTksLT
c2MjYyNjk3Miw1NzkwNTg3NDksMTM3Nzg3MjgwNCwtMjYxNDE0
MDg1LC0xMzc3OTA4NzYzLDExODkyMTk3MjIsLTk3Njc2NTYwNC
wtNDEzMzIzMjM3LDY2MTQ0NzQ1OSwtMTA4MTI5NTE3NiwtMTQ4
NzA2ODAwMCw4MTM1ODU4NjQsMTAxMjUyODI2OCwtMTIzMDQ4Mj
AzOF19
-->