This note details the management of the message tangle.
Started 2 June 2020.


# Summary

Data will be gossiped through the network in objects called messages. These messages will be stored in a data structure called the  message tangle. This specification details how this information is stored and managed.  

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
* `D` gratuitous network delay~5 minutes.  We assume all messages are delivered within this time.
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

Every message in `messageTangle` will be identified through its`MessageID`.  Each message contains the following information ~~which is relevant to this specification~~:
* `parent1` and `parent2` These are message IDs of two other messages and endow the message tangle with a DAG structure.  Together these fields shall be called *parents*.
* `timeStamp` This is a time.  This field will be discussed in Subsection 1. 

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

We will use RURTS which stands for Restricted Uniform Random Tip Selection. This means we choose tips randomly from a list of "good" tips, i.e., the `eligibleTipsList`.  


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

RURTS is easy to implement, computationaly inexpensive, and minimizes orphanage. Moreover, it is in weak Nash equilibrium: honest users have nothing to gain by deviating from the protocol. Moreover, this tip selection algorithm should be resistant to blow ball attacks.  

As demonstrated in the original Iota white paper and subsequent simulations, URTS has no orphans.  Theoretically, RURTS should largely approximate URTS.  The only difference is that some tips may "expire" when they become older than `Delta`.  With a large `Delta`, honest messages will essentially never be orphaned. 

A message disliked by FPC will not be added to `eligibleTipsList` and thus will be orphaned.  Moreover, a message will be orphaned if some message in its past cone is disliked by FPC.  In this way, the algorithms enforce monotonicity in FPC voting, without traversing the tangle marking flags.

Since messages with questionable timestamps will not be flagged eligible until FPC resolves their status, honest messages should not approve them.  Thus, an attacker cannot trick honest messages into being orphaned.

It is necessary that `Delta>w+D` in order to prevent the following attack.  Suppose `w=30`, `D=5`, and `Delta=5`.  Given these parameters, an attacker can maintain a chain of messages whose tip always has a timestamp between `currentTime-10` and `currentTime-15`,   because the timestamps in this interval will always be valid. However, the confirmation confidence ofevery message in this chain will always be `0` because each message is older than `Delta`.  At anytime, the attacker can orphan the entire chain by ceasing issueing messages, but the attacker can also  have the chain reach full confirmation confidence by issueing tips with current timestamps. Thus the status of this chain is indeterminable: the messages are neither "in" nor "out" of the ledger.  This is effectively a liveness attack.  

To summarize, bad messages will be orphaned, and honest messages will not.  Moreover, we claim that there is no middle ground: regardless of an attacker's actions, all messages flagged as eligible will not be orphaned, with high probability.   Indeed, `Delta` will be set significantly greater than `w+D`, thus any message added to the eligible tip list will be eligible for tip selection long enough that it will be eventually selected with high probability.  


### Alternatives

Tips in the eligible tip list might expire, although this should not happen very often given the discussion above. Such tips will be removed from `eligibleTipList` during snapshotting.  However, to optmize efficiency, a node may want to occasionally clean the `eligibleTipList` of expired tips.

Similarly, the `pending` list can be regularly cleaned of messages which will never become eligible.  Indeed, if any message directly references a messase with `opinion=FaLSE`  or `level` 2 or 3, that message can be eliminated from the pending list.  However, if they are not, they will be scrubbed from the pending list during the snapshot.  

Periodically cycling through the pending list may not be efficient.  Instead, a node can check the `pending` list when it performs an action which might cause a message to becoem eligible.  For example, if FPC changes the opinion of a message to `True`  with `level=3`, the node can immediately remove the message can flag it as eligible and move it to the `eligibleTipList`.  Similarly, whenever a message is flagged elible, a node can search `pending` for messages which reference it, and then check if these messages can now be flagged as eligible.  
 
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
* Grade 1: The message and every message in its history satisfy the following: the opinon is `TRUE` and the level is either 2 or 3.  In other words, the message has the `eligible` flag set to `True`.
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

A message is "final" if we are sure that it wont be orphaned. Recall that we call a message is orphaned if it is not indirectly referenced by any eligible tips. Unfortunately, finality can never be definitively determined: we can only describe conditions where the probility of orphanage is low. Each of these grades are examples of such conditions. 

To not be orphaned, a message must be eligible for tip selection, hence Grade 1.  Once eligible, it is possible, though unlikely, that it will be orphaned.  This probability decreases quickly as the message gains more approvers.  Hence a message with say 10% confirmation confidence is very unlikely to be orphaned. Thus we have Grade 2.  

There is a small probability that a grade 2 message might be orpahned. This would happen if other nodes did not choose the approving tips before they expired. This is highly unlikely even in the face of an attack.




Moreover, it is exponentially less likely that an old grade 2 message will be orphaned, hence the definition of grade 3.  Let us explain.  Because of the below max depth check, in order for an old message `M` to have grade level 2, `M` must belong to a chain of grade 2 messages whose length is proportional to its age. If  `M` is orphaned, then the whole chain must be orphaned. Thus, the situation described in the previous paragraph would have to repeat several times.

### Open questions

We need to understand the probabilities of orphanage associated with each level of finality.  As discussed earlier, these probabilites should be small, but it would be useful to know how small.  In studying these questions, we may also find that two of these finalities are essentially the same.  

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
N0YXJ0Ijo5NDcsImVuZCI6MTAwMSwidGV4dCI6IldlIGFzc3Vt
ZSBhbGwgbWVzc2FnZXMgYXJlIGRlbGl2ZXJlZCB3aXRoaW4gdG
hpcyB0aW1lLiJ9LCJNUk1qZXJqaHk0YllHRWtvIjp7InN0YXJ0
IjoxNDc4LCJlbmQiOjE1MzEsInRleHQiOiJwZW5kaW5nYCBUaG
UgbWVzc2FnZXMgbm90IGVsaWdpYmxlIGZvciB0aXAgc2VsZWN0
aW9uLiJ9LCJYSFd0bXE5bjBsY1VQSHluIjp7InN0YXJ0IjoxOT
c5LCJlbmQiOjE5ODgsInRleHQiOiJNZXNzYWdlSUQifSwibFdN
RGFpNFdsQzlHdnBlcSI6eyJzdGFydCI6MTE4MywiZW5kIjoxMj
IxLCJ0ZXh0IjoidGltZSBmb3IgZ3JhZGUgMyBmaW5hbGl0eSBm
b3IgbWVzc2FnZXMifSwiSHFkV1dEVFBreE8yb3R1WiI6eyJzdG
FydCI6MTEyNCwiZW5kIjoxMTc0LCJ0ZXh0IjoiY29uZmlkZW5j
ZSBsZXZlbCBvZiBncmFkZSAyIGZpbmFsaXR5IGZvciBtZXNzYW
dlcy4ifSwiYVlYTG03RUM5ejJMSlR4TiI6eyJzdGFydCI6MjU3
MCwiZW5kIjoyNTc0LCJ0ZXh0IjoidGltZSJ9LCJoTkNLVERkZT
M4YXU1WXV1Ijp7InN0YXJ0IjoyMjgwLCJlbmQiOjIyODQsInRl
eHQiOiJ0aW1lIn0sIllaT2c3emMxcmJPR2ZsZFoiOnsic3Rhcn
QiOjI1MDgsImVuZCI6MjUyMiwidGV4dCI6IndpbGwgYmUgc3Rv
cmVkIn0sIjhabUNFc2loelhKRk05MTIiOnsic3RhcnQiOjI5Nj
ksImVuZCI6Mjk3MSwidGV4dCI6ImlzIn0sIk9xWWRyWXN5YXJi
SG9ZRWciOnsic3RhcnQiOjMzNTUsImVuZCI6MzM2NywidGV4dC
I6ImN1cnJlbnQgdGltZSJ9LCJMUnN1THBLY28yMFRsVGUzIjp7
InN0YXJ0IjozMzY5LCJlbmQiOjMzODUsInRleHQiOiJUaGlzIH
RpbWUgd2luZG93In0sImZSZ3NGWm5yVGNmZTI0YjMiOnsic3Rh
cnQiOjM0NTEsImVuZCI6MzQ2NSwidGV4dCI6IldoZW4gYSBtZX
NzYWdlIn0sIko2aXJIckV1VWxSaU1SMGUiOnsic3RhcnQiOjQ3
NzcsImVuZCI6NDgyOSwidGV4dCI6IldoZW4gYSBtZXNzYWdlIG
lzIGFkZGVkIHRvIHRoZSB0YW5nbGUsIHRoZSBub2RlIHJ1bnMi
fSwiN0NRWnYzWUZxaWJ4eFBzVSI6eyJzdGFydCI6NTE0MiwiZW
5kIjo1MTUyLCJ0ZXh0IjoiaXMgZGVsZXRlZCJ9fSwiY29tbWVu
dHMiOnsiWFdDN3JDV1d1OXNFM1I4diI6eyJkaXNjdXNzaW9uSW
QiOiJra0VvZ1ZoeHBPa1pWcldFIiwic3ViIjoiZ2g6NTExMTI2
MTgiLCJ0ZXh0IjoiVGhpcyBpcyBhIHN0cm9uZyBhc3N1bXB0aW
9uIGFuZCBtYXkgYmUgaW50ZXJwcmV0ZWQgaW4gYSB3cm9uZyB3
YXkuIFdoYXQgaGFwcGVucyBvZiBvbmUgbWVzc2FnZSBpcyBub3
QgZGVsaXZlcmVkIG9uIHRpbWU/IFByb3RvY29sIGJyZWFrcz8i
LCJjcmVhdGVkIjoxNTk1NTcyNjI0OTMzfSwiSWM5c2Z3eVZwOX
h2UlhmSSI6eyJkaXNjdXNzaW9uSWQiOiJNUk1qZXJqaHk0YllH
RWtvIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiSXMgdG
hpcyB0aGUgTWVzc2FnZSBJbmJveCBmcm9tIDEtMyA/IiwiY3Jl
YXRlZCI6MTU5NTU3Mjc1NTM2MX0sIkFRZzJtaXI2dVhwQ09JMT
YiOnsiZGlzY3Vzc2lvbklkIjoiTVJNamVyamh5NGJZR0VrbyIs
InN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IlByb2JhYmx5IG
9ubHkgdGhlIHN1YnNldCB0aGF0IGlzIG5vbi1lbGlnaWJsZS4i
LCJjcmVhdGVkIjoxNTk1NTcyNzkzNjkzfSwiRllYVVc3VU9ZNW
Vvc0pCaiI6eyJkaXNjdXNzaW9uSWQiOiJYSFd0bXE5bjBsY1VQ
SHluIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoibWVzc2
FnZUlEPyIsImNyZWF0ZWQiOjE1OTU1NzI5ODY4MTd9LCJheVRa
a1BrN3JZdE5iQVpDIjp7ImRpc2N1c3Npb25JZCI6ImxXTURhaT
RXbEM5R3ZwZXEiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQi
OiJub3QgY2xlYXIgd2l0aG91dCBrbm93aW5nIHdoYXQgaXQgaX
MgYWxyZWFkeSIsImNyZWF0ZWQiOjE1OTU1NzM0NDAyNTN9LCJB
Z0ZOTlhIa3FNTGdXNTNrIjp7ImRpc2N1c3Npb25JZCI6IkhxZF
dXRFRQa3hPMm90dVoiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRl
eHQiOiJkb24gdCB1bmRlcnN0YW5kIiwiY3JlYXRlZCI6MTU5NT
U3MzQ3OTEwOH0sImU2bVRXM0FQVnpFTkVSTnAiOnsiZGlzY3Vz
c2lvbklkIjoiYVlYTG03RUM5ejJMSlR4TiIsInN1YiI6ImdoOj
UxMTEyNjE4IiwidGV4dCI6Ikkgc3VnZ2VzdCB0byBhbHd5YXMg
d3JpdGUgXCJsb2NhbCB0aW1lXCIgaWYgaXQgaXMgdGhlIGxvY2
FsIHRpbWUgb2YgYSBwYXJ0aWN1bGFyIG5vZGUiLCJjcmVhdGVk
IjoxNTk1NTczNzc5MzE5fSwiQllOUHV1RFpVTEpVUjZBZSI6ey
JkaXNjdXNzaW9uSWQiOiJoTkNLVERkZTM4YXU1WXV1Iiwic3Vi
IjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiU3RyaWN0bHkgc3BlYW
tpbmcgdGhpcyBpcyBub3QgYSB0aW1lLCBtb3JlIGEgcG9pbnQg
aW4gdGltZSAod2UgYmVsaWV2ZSB0byBsaXZlIGluKS4gVU5JWC
10aW1lPyIsImNyZWF0ZWQiOjE1OTU1NzQ1MzI4NzN9LCJaUHZ1
b0ZMZ1ZyVW1YMmJHIjp7ImRpc2N1c3Npb25JZCI6IllaT2c3em
MxcmJPR2ZsZFoiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQi
OiJ3aGVyZSB3aWxsIHRoZXkgYmUgc3RvcmVkPyIsImNyZWF0ZW
QiOjE1OTU1NzQ2MzY1Nzl9LCJLaTZtZGlvUFNHaU9LanNXIjp7
ImRpc2N1c3Npb25JZCI6IjhabUNFc2loelhKRk05MTIiLCJzdW
IiOiJnaDo1MTExMjYxOCIsInRleHQiOiJtYWtlIGNvbnNpc3Rl
bnQ7IHN0YXJ0IHVwcGVyIG9yIGxvd2VyIGNhc2UgYWZ0ZXIgJy
AnLCBvciB1c2UgOiA/IiwiY3JlYXRlZCI6MTU5NTU3NDc2NzA1
OX0sInEzT1E5Qm9nbzQ4aFU0VHAiOnsiZGlzY3Vzc2lvbklkIj
oiOFptQ0VzaWh6WEpGTTkxMiIsInN1YiI6ImdoOjUxMTEyNjE4
IiwidGV4dCI6InVzZSB0aGUgc2FtZSB0aHJvdWdob3V0IHRoZS
BzcGVjcyIsImNyZWF0ZWQiOjE1OTU1NzQ4MTI3MTZ9LCJ2WWoz
NFV6SEZ0T3VrSHNIIjp7ImRpc2N1c3Npb25JZCI6Ik9xWWRyWX
N5YXJiSG9ZRWciLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQi
OiJjdXJyZW50IGxvY2FsIHRpbWU/IiwiY3JlYXRlZCI6MTU5NT
U3NTAwOTI2NX0sImFhUjUzUmJaanJhTlFoam8iOnsiZGlzY3Vz
c2lvbklkIjoiT3FZZHJZc3lhcmJIb1lFZyIsInN1YiI6ImdoOj
UxMTEyNjE4IiwidGV4dCI6ImlmIGl0IHJlZmVycyB0byB0aGUg
dmFyaWFibGUgYGN1cnJlbnQgdGltZWBhZGQgdGhlc2UgYHMiLC
JjcmVhdGVkIjoxNTk1NTc1MDg2Mzk5fSwidktHQUVjN0VkM0RM
M0M1cyI6eyJkaXNjdXNzaW9uSWQiOiJMUnN1THBLY28yMFRsVG
UzIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiQlRXIHdo
ZXJlIGlzIGl0IHNwZWNpZmllZCBob3cgdG8gY2hvb3NlIHcgYW
5kIHRoZSBvdGhlciBwYXJhbWV0ZXJzPyIsImNyZWF0ZWQiOjE1
OTU1NzUxNDM0Mzd9LCJUcDNQeFlVbU44RHB1dmVrIjp7ImRpc2
N1c3Npb25JZCI6ImZSZ3NGWm5yVGNmZTI0YjMiLCJzdWIiOiJn
aDo1MTExMjYxOCIsInRleHQiOiJJcyB0aGlzIGFmdGVyIHRoZS
BtZXNzYWdlIHBhc3NlZCB0aGUgcmF0ZSBtYW5hZ2VyPyBJZiB5
ZXMsIEkgbSBhIGJpdCBjb25mdXNlZCwgbm9kZSB3aXRoIGRpZm
ZlcmVudCBtYW5hIHBlcmNlcHRpb24gbWlnaHQgaGFuZGxlIHRo
ZSBtZXNzYWdlIGRpZmZlcmVudGx5IiwiY3JlYXRlZCI6MTU5NT
U3NTU2MzE3MH0sIlY0ZEtiZndRN1BYQkZJYzYiOnsiZGlzY3Vz
c2lvbklkIjoiSjZpckhyRXVVbFJpTVIwZSIsInN1YiI6ImdoOj
UxMTEyNjE4IiwidGV4dCI6IkRvZXMgdGhpcyBjb21lIGJlZm9y
ZSB0aGUgYWJvdmUgc3RlcCBvciBhZnRlcj8gQSBncmFwaCBsaW
tlIGluIDEtMyBzaG93aW5nIHRoZSBwcm9jZXNzZXMgbWlnaHQg
YmUgZ29vZCIsImNyZWF0ZWQiOjE1OTU1NzYxMjU3MzF9LCJ3Mn
FVOEREWENzUmd0ZEZIIjp7ImRpc2N1c3Npb25JZCI6IjdDUVp2
M1lGcWlieHhQc1UiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleH
QiOiJmcm9tIHdoZXJlPyBNZXNzYWdlIEluYm94PyBTdGlsbCBn
b3NzaXBlZCBvciBub3Q/IiwiY3JlYXRlZCI6MTU5NTU3NjE1OT
QwNX0sIkxQdlV0RFE1T2Vsazh5QzUiOnsiZGlzY3Vzc2lvbklk
IjoiSjZpckhyRXVVbFJpTVIwZSIsInN1YiI6ImdoOjUxMTEyNj
E4IiwidGV4dCI6Ik9yIGlzIHRoaXMgY29udGFpbmVkIGluIHRo
ZSB0aW1lc3RhbXAgY2hlY2sgaW4gMS0zPyIsImNyZWF0ZWQiOj
E1OTU1NzYyOTYyNTZ9fSwiaGlzdG9yeSI6Wy05NzY3NjU2MDQs
LTQxMzMyMzIzNyw2NjE0NDc0NTksLTEwODEyOTUxNzYsLTE0OD
cwNjgwMDAsODEzNTg1ODY0LDEwMTI1MjgyNjgsLTEyMzA0ODIw
MzgsLTEzNDE4OTMzMjksLTUyNDA1ODkzNF19
-->