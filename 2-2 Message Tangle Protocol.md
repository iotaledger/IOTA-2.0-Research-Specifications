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
LCJ0ZXh0Ijoid2VhayBOYXNoIGVxdWlsaWJyaXVtOiJ9fSwiY2
9tbWVudHMiOnsiWFdDN3JDV1d1OXNFM1I4diI6eyJkaXNjdXNz
aW9uSWQiOiJra0VvZ1ZoeHBPa1pWcldFIiwic3ViIjoiZ2g6NT
ExMTI2MTgiLCJ0ZXh0IjoiVGhpcyBpcyBhIHN0cm9uZyBhc3N1
bXB0aW9uIGFuZCBtYXkgYmUgaW50ZXJwcmV0ZWQgaW4gYSB3cm
9uZyB3YXkuIFdoYXQgaGFwcGVucyBvZiBvbmUgbWVzc2FnZSBp
cyBub3QgZGVsaXZlcmVkIG9uIHRpbWU/IFByb3RvY29sIGJyZW
Frcz8iLCJjcmVhdGVkIjoxNTk1NTcyNjI0OTMzfSwiSWM5c2Z3
eVZwOXh2UlhmSSI6eyJkaXNjdXNzaW9uSWQiOiJNUk1qZXJqaH
k0YllHRWtvIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ijoi
SXMgdGhpcyB0aGUgTWVzc2FnZSBJbmJveCBmcm9tIDEtMyA/Ii
wiY3JlYXRlZCI6MTU5NTU3Mjc1NTM2MX0sIkFRZzJtaXI2dVhw
Q09JMTYiOnsiZGlzY3Vzc2lvbklkIjoiTVJNamVyamh5NGJZR0
VrbyIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IlByb2Jh
Ymx5IG9ubHkgdGhlIHN1YnNldCB0aGF0IGlzIG5vbi1lbGlnaW
JsZS4iLCJjcmVhdGVkIjoxNTk1NTcyNzkzNjkzfSwiRllYVVc3
VU9ZNWVvc0pCaiI6eyJkaXNjdXNzaW9uSWQiOiJYSFd0bXE5bj
BsY1VQSHluIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ijoi
bWVzc2FnZUlEPyIsImNyZWF0ZWQiOjE1OTU1NzI5ODY4MTd9LC
JheVRaa1BrN3JZdE5iQVpDIjp7ImRpc2N1c3Npb25JZCI6ImxX
TURhaTRXbEM5R3ZwZXEiLCJzdWIiOiJnaDo1MTExMjYxOCIsIn
RleHQiOiJub3QgY2xlYXIgd2l0aG91dCBrbm93aW5nIHdoYXQg
aXQgaXMgYWxyZWFkeSIsImNyZWF0ZWQiOjE1OTU1NzM0NDAyNT
N9LCJBZ0ZOTlhIa3FNTGdXNTNrIjp7ImRpc2N1c3Npb25JZCI6
IkhxZFdXRFRQa3hPMm90dVoiLCJzdWIiOiJnaDo1MTExMjYxOC
IsInRleHQiOiJkb24gdCB1bmRlcnN0YW5kIiwiY3JlYXRlZCI6
MTU5NTU3MzQ3OTEwOH0sImU2bVRXM0FQVnpFTkVSTnAiOnsiZG
lzY3Vzc2lvbklkIjoiYVlYTG03RUM5ejJMSlR4TiIsInN1YiI6
ImdoOjUxMTEyNjE4IiwidGV4dCI6Ikkgc3VnZ2VzdCB0byBhbH
d5YXMgd3JpdGUgXCJsb2NhbCB0aW1lXCIgaWYgaXQgaXMgdGhl
IGxvY2FsIHRpbWUgb2YgYSBwYXJ0aWN1bGFyIG5vZGUiLCJjcm
VhdGVkIjoxNTk1NTczNzc5MzE5fSwiQllOUHV1RFpVTEpVUjZB
ZSI6eyJkaXNjdXNzaW9uSWQiOiJoTkNLVERkZTM4YXU1WXV1Ii
wic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiU3RyaWN0bHkg
c3BlYWtpbmcgdGhpcyBpcyBub3QgYSB0aW1lLCBtb3JlIGEgcG
9pbnQgaW4gdGltZSAod2UgYmVsaWV2ZSB0byBsaXZlIGluKS4g
VU5JWC10aW1lPyIsImNyZWF0ZWQiOjE1OTU1NzQ1MzI4NzN9LC
JaUHZ1b0ZMZ1ZyVW1YMmJHIjp7ImRpc2N1c3Npb25JZCI6Illa
T2c3emMxcmJPR2ZsZFoiLCJzdWIiOiJnaDo1MTExMjYxOCIsIn
RleHQiOiJ3aGVyZSB3aWxsIHRoZXkgYmUgc3RvcmVkPyIsImNy
ZWF0ZWQiOjE1OTU1NzQ2MzY1Nzl9LCJLaTZtZGlvUFNHaU9Lan
NXIjp7ImRpc2N1c3Npb25JZCI6IjhabUNFc2loelhKRk05MTIi
LCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJtYWtlIGNvbn
Npc3RlbnQ7IHN0YXJ0IHVwcGVyIG9yIGxvd2VyIGNhc2UgYWZ0
ZXIgJyAnLCBvciB1c2UgOiA/IiwiY3JlYXRlZCI6MTU5NTU3ND
c2NzA1OX0sInEzT1E5Qm9nbzQ4aFU0VHAiOnsiZGlzY3Vzc2lv
bklkIjoiOFptQ0VzaWh6WEpGTTkxMiIsInN1YiI6ImdoOjUxMT
EyNjE4IiwidGV4dCI6InVzZSB0aGUgc2FtZSB0aHJvdWdob3V0
IHRoZSBzcGVjcyIsImNyZWF0ZWQiOjE1OTU1NzQ4MTI3MTZ9LC
J2WWozNFV6SEZ0T3VrSHNIIjp7ImRpc2N1c3Npb25JZCI6Ik9x
WWRyWXN5YXJiSG9ZRWciLCJzdWIiOiJnaDo1MTExMjYxOCIsIn
RleHQiOiJjdXJyZW50IGxvY2FsIHRpbWU/IiwiY3JlYXRlZCI6
MTU5NTU3NTAwOTI2NX0sImFhUjUzUmJaanJhTlFoam8iOnsiZG
lzY3Vzc2lvbklkIjoiT3FZZHJZc3lhcmJIb1lFZyIsInN1YiI6
ImdoOjUxMTEyNjE4IiwidGV4dCI6ImlmIGl0IHJlZmVycyB0by
B0aGUgdmFyaWFibGUgYGN1cnJlbnQgdGltZWBhZGQgdGhlc2Ug
YHMiLCJjcmVhdGVkIjoxNTk1NTc1MDg2Mzk5fSwidktHQUVjN0
VkM0RMM0M1cyI6eyJkaXNjdXNzaW9uSWQiOiJMUnN1THBLY28y
MFRsVGUzIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiQl
RXIHdoZXJlIGlzIGl0IHNwZWNpZmllZCBob3cgdG8gY2hvb3Nl
IHcgYW5kIHRoZSBvdGhlciBwYXJhbWV0ZXJzPyIsImNyZWF0ZW
QiOjE1OTU1NzUxNDM0Mzd9LCJUcDNQeFlVbU44RHB1dmVrIjp7
ImRpc2N1c3Npb25JZCI6ImZSZ3NGWm5yVGNmZTI0YjMiLCJzdW
IiOiJnaDo1MTExMjYxOCIsInRleHQiOiJJcyB0aGlzIGFmdGVy
IHRoZSBtZXNzYWdlIHBhc3NlZCB0aGUgcmF0ZSBtYW5hZ2VyPy
BJZiB5ZXMsIEkgbSBhIGJpdCBjb25mdXNlZCwgbm9kZSB3aXRo
IGRpZmZlcmVudCBtYW5hIHBlcmNlcHRpb24gbWlnaHQgaGFuZG
xlIHRoZSBtZXNzYWdlIGRpZmZlcmVudGx5IiwiY3JlYXRlZCI6
MTU5NTU3NTU2MzE3MH0sIlY0ZEtiZndRN1BYQkZJYzYiOnsiZG
lzY3Vzc2lvbklkIjoiSjZpckhyRXVVbFJpTVIwZSIsInN1YiI6
ImdoOjUxMTEyNjE4IiwidGV4dCI6IkRvZXMgdGhpcyBjb21lIG
JlZm9yZSB0aGUgYWJvdmUgc3RlcCBvciBhZnRlcj8gQSBncmFw
aCBsaWtlIGluIDEtMyBzaG93aW5nIHRoZSBwcm9jZXNzZXMgbW
lnaHQgYmUgZ29vZCIsImNyZWF0ZWQiOjE1OTU1NzYxMjU3MzF9
LCJ3MnFVOEREWENzUmd0ZEZIIjp7ImRpc2N1c3Npb25JZCI6Ij
dDUVp2M1lGcWlieHhQc1UiLCJzdWIiOiJnaDo1MTExMjYxOCIs
InRleHQiOiJmcm9tIHdoZXJlPyBNZXNzYWdlIEluYm94PyBTdG
lsbCBnb3NzaXBlZCBvciBub3Q/IiwiY3JlYXRlZCI6MTU5NTU3
NjE1OTQwNX0sIkxQdlV0RFE1T2Vsazh5QzUiOnsiZGlzY3Vzc2
lvbklkIjoiSjZpckhyRXVVbFJpTVIwZSIsInN1YiI6ImdoOjUx
MTEyNjE4IiwidGV4dCI6Ik9yIGlzIHRoaXMgY29udGFpbmVkIG
luIHRoZSB0aW1lc3RhbXAgY2hlY2sgaW4gMS0zPyIsImNyZWF0
ZWQiOjE1OTU1NzYyOTYyNTZ9LCJrM1hEWFVSaDF5dDVpN3dXIj
p7ImRpc2N1c3Npb25JZCI6ImpTd2ZPY21aM0J1YWpyb1MiLCJz
dWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJkb24gdCB1bmRlcn
N0YW5kPyBJcyB0aGlzIGdldFRpcCBmb3IgbmV3IG1lc3NhZ2Uu
SUQ/IiwiY3JlYXRlZCI6MTU5NTU3NjkyMzYyOH0sIjVYdnNTTH
owcW5HdGZhcWIiOnsiZGlzY3Vzc2lvbklkIjoibWVDRUlwWjV4
TE1LdWNnTSIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6In
doZXJlIGlzIHRoaXMgZGVmaW5lZD8iLCJjcmVhdGVkIjoxNTk1
NTc3MTgxMjU5fSwid2V0TzZGQU9hZGJZNFplZSI6eyJkaXNjdX
NzaW9uSWQiOiJET29sN0pJWE9PYkxFdFhGIiwic3ViIjoiZ2g6
NTExMTI2MTgiLCJ0ZXh0IjoiVGhpcyBzaG91bGQgYmUgY2FsY3
VsYWJsZS4gVW5kZXIgc29tZSBhc3N1bXB0aW9ucyBvZiBtYWxp
Y2lvdXMgbXBzIGFuZCBob25lc3QgbXBzIGV2ZW4gdGhlb3JldG
ljYWxseS4iLCJjcmVhdGVkIjoxNTk1NTc3NjMxNzU2fSwibGp3
b1NzN0FPWlU0ZUczcSI6eyJkaXNjdXNzaW9uSWQiOiJLVVVQV2
5IMzEwWVBQNm5EIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0
IjoiSXMgdGhpcyB0aGUgZGVmaW5pdGlvbiBvZiBjb25maWRlbm
NlIGxldmVsPyIsImNyZWF0ZWQiOjE1OTU1Nzc5NjUzMzF9LCJl
S0NJRW9TdzI4cXBVS1hOIjp7ImRpc2N1c3Npb25JZCI6ImcyTU
Z4OWNCWm9oU0V3UWUiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRl
eHQiOiJ3aGVyZSBpcyB0aGlzIGRlZmluZWQ/IiwiY3JlYXRlZC
I6MTU5NTU3ODAyODcwMX0sIkRUcWRoQTE4aDF3cFJ3bnUiOnsi
ZGlzY3Vzc2lvbklkIjoiZWNSVDB1ZzRPTFV1WnpjYyIsInN1Yi
I6ImdoOjUxMTEyNjE4IiwidGV4dCI6ImlzIHRoZXJlIGEgY2hh
bmNlIHRoYXQgYSBtZXNzYWdlIGdldHMgdHJhcHBlZCBpbiB0aG
UgTWVzc2FnZSBJbmJveCBhbmQgaGFzIHRvIGJlIHJlbW92ZWQg
dG9vPyIsImNyZWF0ZWQiOjE1OTU1Nzg0ODg1NTF9LCJiZW85NH
d1Y1daaUxHYUpaIjp7ImRpc2N1c3Npb25JZCI6IkNOc1hCdkEz
RHo4SWc2WGkiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOi
JXaGF0IGhhcHBlbnMgaWYgZWxpZ2libGVUaXBzTGlzdCBpcyBl
bXB0eSBmb3IgYWxsIG5vZGVzPyBTaG91bGQgbnQgd2UgdGhpbm
sgYWJvdXQgaGFuZGxpbmcgdGhpcyBjYXNlPyIsImNyZWF0ZWQi
OjE1OTU1Nzg2MzExMzZ9LCJyR1RyMVZGMG1GUWNqZDI4Ijp7Im
Rpc2N1c3Npb25JZCI6IkxSc3VMcEtjbzIwVGxUZTMiLCJzdWIi
OiJnaDo2ODI1MDM1MCIsInRleHQiOiJVc3VhbGx5IFNlcmd1ZW
kgc2F5cyBcIlB1dCBhbnkgcmVhc29uYWJsZSBpbml0aWFsIHBh
cmFtZXRlciBhbmQgd2UgY2hhbmdlIGFmdGVyIHRlc3RpbmdcIi
4iLCJjcmVhdGVkIjoxNTk1ODc5Mzc3NzAwfSwiZTdKWVpEaVBw
azNHeGpBZSI6eyJkaXNjdXNzaW9uSWQiOiJKNmlySHJFdVVsUm
lNUjBlIiwic3ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiRnJv
bSB0aGUgbGFzdCBkaXNjdXNzaW9uIGZyb20gdGhlIGdyb3VwLC
BCTUQgY2hlY2sgaXMgcGFydCBvZiBzb2xpZGlmaWNhdGlvbiwg
cGVoYXBzIHdlIG5lZWQgdG8gY2hhbmdlIHNlc3Npb25zIHRvIH
JlZmxlY3QgdGhpcz8gSSB3aWxsIGRpc2N1c3MgdGhpcyBpbiB0
aGUgcHJvdG9jb2wgY2FsbCB0b21vcnJvdyEiLCJjcmVhdGVkIj
oxNTk1ODc5NzAyMzcyfSwiajJxam9LYTU1b0JBNjM5cyI6eyJk
aXNjdXNzaW9uSWQiOiJSS3E5ZWttdVVrVXdIeGV1Iiwic3ViIj
oiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiUmVwZWF0ZWQgXCJNb3Jl
b3ZlclwiLCB1c2Ugb3RoZXIgd29yZCBsaWtlIFwiQWRkaXRpb2
5hbGx5XCIiLCJjcmVhdGVkIjoxNTk1ODgwMDQyNTYxfSwiRVI0
bUtCcEU3TWEyVDU2ZSI6eyJkaXNjdXNzaW9uSWQiOiJsQnZndG
JHYUJUdmZWU1lnIiwic3ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0
IjoiSU9UQSIsImNyZWF0ZWQiOjE1OTU4ODAwNzQyNTN9LCJMWj
Rya1pGVGM3eGZJNjlSIjp7ImRpc2N1c3Npb25JZCI6IlVzUGxa
RTFYQXVzMDdTTDAiLCJzdWIiOiJnaDo2ODI1MDM1MCIsInRleH
QiOiJJcyBpdCBvayB0byB1c2UgdGhlIG1hdGhlbWF0aWNhbCB0
ZXJtaW5vbG9neSBoZXJlPyIsImNyZWF0ZWQiOjE1OTU4ODA3ND
A1MDF9fSwiaGlzdG9yeSI6WzE2OTg5NDYyODIsMTgzMTcyMDA1
MSwtMTg2MDExODg2NiwxMDYzMTk1Njc3LDEzODMwMTQxNDUsMT
U1NDQ4MzUwMywtNzYyMDEyMTk5LC03NjI2MjY5NzIsNTc5MDU4
NzQ5LDEzNzc4NzI4MDQsLTI2MTQxNDA4NSwtMTM3NzkwODc2My
wxMTg5MjE5NzIyLC05NzY3NjU2MDQsLTQxMzMyMzIzNyw2NjE0
NDc0NTksLTEwODEyOTUxNzYsLTE0ODcwNjgwMDAsODEzNTg1OD
Y0LDEwMTI1MjgyNjhdfQ==
-->