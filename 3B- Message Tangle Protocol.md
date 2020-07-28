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

Every message in `messageTangle` will be identified through its `MessageID`.  Amongst other things, each message contains the following information:
* `parent1` and `parent2` These are message IDs of two other messages and endow the message tangle with a DAG structure.  Together these fields shall be called *parents*.
* `timeStamp` This is a time.  This field will be discussed in SubsSection 1. 

Messages of course have other information, but they are not relevant for this specification.  See [BLANK](https://) for a full account on the layouts of messages.

Messages will be stored with the following fields:
* `arrivalTime` The local time that the message first arrived to the node.  
* `opinionField` Contains the nodes' opinion on the timestamp of a message.  As specified [here](https://hackmd.io/xBfQ04NkRi6IrwhEQm7aJQ), this field is a triple `(opinion,level,timeFormed)`, where `opinion` is a Boolean value, `level` is in the set {1,2,3}, and `timeFormed` is a time. The `opinionField` is also manipulated by FPC.
* `eligible` is a Boolean value, denoting if the message was ever eligible for tip selection. 

# Main Components

## 1. Timestamps
 

Every message contains the field `timeStamp` which is signed.  The timestamp should be the time when the message was created, and this will be enforced to some degree through voting.  Specifically, nodes will vote on whether the timestamp was issued within `w` of current local time. This time window is large to account for the network delay. 

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
oxMTc3fSwiaE5DS1REZGUzOGF1NVl1dSI6eyJ0ZXh0IjoidGlt
ZSIsInN0YXJ0IjoyMjYyLCJlbmQiOjIyNjZ9LCJZWk9nN3pjMX
JiT0dmbGRaIjp7InRleHQiOiJ3aWxsIGJlIHN0b3JlZCIsInN0
YXJ0IjoyNDkxLCJlbmQiOjI1MDV9LCI4Wm1DRXNpaHpYSkZNOT
EyIjp7InRleHQiOiJpcyIsInN0YXJ0IjoyOTU4LCJlbmQiOjI5
NjB9LCJPcVlkcllzeWFyYkhvWUVnIjp7InRleHQiOiJjdXJyZW
50IHRpbWUiLCJzdGFydCI6MzM0NCwiZW5kIjozMzYyfSwiTFJz
dUxwS2NvMjBUbFRlMyI6eyJ0ZXh0IjoiVGhpcyB0aW1lIHdpbm
RvdyIsInN0YXJ0IjozMzY0LCJlbmQiOjMzODB9LCJmUmdzRlpu
clRjZmUyNGIzIjp7InRleHQiOiJXaGVuIGEgbWVzc2FnZSIsIn
N0YXJ0IjozNDQ2LCJlbmQiOjM0NjB9LCJKNmlySHJFdVVsUmlN
UjBlIjp7InRleHQiOiJXaGVuIGEgbWVzc2FnZSBpcyBhZGRlZC
B0byB0aGUgdGFuZ2xlLCB0aGUgbm9kZSBydW5zIiwic3RhcnQi
OjQ3NzIsImVuZCI6NDgyNH0sIjdDUVp2M1lGcWlieHhQc1UiOn
sidGV4dCI6ImlzIGRlbGV0ZWQiLCJzdGFydCI6NTEzNywiZW5k
Ijo1MTQ3fSwialN3Zk9jbVozQnVhanJvUyI6eyJ0ZXh0IjoiY3
VycmVudFRpbWUtbWVzc2FnZUlkLnRpbWVTdGFtcDxEZWx0YSIs
InN0YXJ0Ijo2OTY4LCJlbmQiOjcwMDV9LCJtZUNFSXBaNXhMTU
t1Y2dNIjp7InRleHQiOiJjb25maXJtYXRpb24gY29uZmlkZW5j
ZSIsInN0YXJ0Ijo4NTYyLCJlbmQiOjg1ODV9LCJET29sN0pJWE
9PYkxFdFhGIjp7InRleHQiOiJXZSBrbm93IGZvciBpbnN0YW5j
ZSB0aGUgcHJvYmFiaWxpdHkgb2YgYmVpbmcgb3JwaGFuZWQgaX
MgXCJzbWFsbFwiLCBidXQgd2UgZG8gbm/igKYiLCJzdGFydCI6
MTExODIsImVuZCI6MTEzMTJ9LCJLVVVQV25IMzEwWVBQNm5EIj
p7InRleHQiOiJjb25maXJtYXRpb25Db25maWRlbmMiLCJzdGFy
dCI6MTI2NDksImVuZCI6MTI2NzB9LCJnMk1GeDljQlpvaFNFd1
FlIjp7InRleHQiOiJSZWNhbGwgdCIsInN0YXJ0IjoxMzAxOCwi
ZW5kIjoxMzAyNn0sImVjUlQwdWc0T0xVdVp6Y2MiOnsidGV4dC
I6ImhlIGZvbGxvd2luZyIsInN0YXJ0IjoxNTEyMywiZW5kIjox
NTEzNX0sIkNOc1hCdkEzRHo4SWc2WGkiOnsidGV4dCI6IlRpcH
Mgc2VsZWN0aW9uIiwic3RhcnQiOjU0MjIsImVuZCI6NTQzNn0s
IlJLcTlla211VWtVd0h4ZXUiOnsidGV4dCI6Ik1vcmVvdmVyLC
IsInN0YXJ0Ijo3MzA2LCJlbmQiOjczMTV9LCJsQnZndGJHYUJU
dmZWU1lnIjp7InRleHQiOiJJb3RhIiwic3RhcnQiOjc0MjIsIm
VuZCI6NzQyNn0sIlVzUGxaRTFYQXVzMDdTTDAiOnsidGV4dCI6
IndlYWsgTmFzaCBlcXVpbGlicml1bToiLCJzdGFydCI6NzIxNy
wiZW5kIjo3MjM5fSwiUEpCeHdKZmFNQzBjMEs2aSI6eyJ0ZXh0
IjoiYmxvdyBiYWxsIGF0dGFja3MiLCJzdGFydCI6NzM2OCwiZW
5kIjo3Mzg1fSwiaVNhTUxtc002ZU1LQ2p4SiI6eyJ0ZXh0Ijoi
V2l0aCBhIGxhcmdlIGBEZWx0YWAsIGhvbmVzdCBtZXNzYWdlcy
B3aWxsIGVzc2VudGlhbGx5IG5ldmVyIGJlIG9ycGhhbmVkLiIs
InN0YXJ0Ijo3NjMzLCJlbmQiOjc3MDZ9LCJ3Tkd3dDh0M2p4eD
RrWlczIjp7InRleHQiOiJ3aXRob3V0IHRyYXZlcnNpbmcgdGhl
IHRhbmdsZSBtYXJraW5nIGZsYWdzLiIsInN0YXJ0Ijo3OTU4LC
JlbmQiOjgwMDJ9LCJnVkVKQjV1SklwY0V4TTNzIjp7InRleHQi
OiJmb2xsb3dpbmcgYXR0YWNrIiwic3RhcnQiOjgyNzgsImVuZC
I6ODI5NH0sIkdOYkQ3SmhVdHg5aGNYcVMiOnsidGV4dCI6Im9y
cGhhbmVkIiwic3RhcnQiOjkyMzksImVuZCI6OTI0N30sIm5xRj
djbGNYOFB2cjlubFUiOnsidGV4dCI6IkZpbmFsaXR5Iiwic3Rh
cnQiOjExMzI0LCJlbmQiOjExMzMyfSwiR0Z6Y3REUVJ5RmZ6eT
l2eCI6eyJ0ZXh0IjoiUGVyaW9kaWNhbGx5Iiwic3RhcnQiOjYy
NDMsImVuZCI6NjI1NX0sIjUyNncxMEI5UXhMN2RHWWYiOnsidG
V4dCI6IkdyYWRlIDEiLCJzdGFydCI6MTIxNzMsImVuZCI6MTIx
ODB9LCJNcncxSUducFpCQ2JKRExqIjp7InRleHQiOiIuIiwic3
RhcnQiOjE0MDA2LCJlbmQiOjE0MDA3fSwidWNxU3FqRkxYUHZz
dVZHVCI6eyJ0ZXh0IjoiUmVtb3ZlIG1lc3NhZ2VJRCBmcm9tIG
BwZW5kaW5nYCBpZiBwcmVzZW50XG4qIFJlbW92ZSBtZXNzYWdl
SUQgZnJvbSBgZWxpZ2libGVUaXDigKYiLCJzdGFydCI6MTUxMz
ksImVuZCI6MTUyNzZ9LCJsVTl2N0Z3MnRXSEtLbk9jIjp7InRl
eHQiOiJEZWx0YT5tZXNzYWdlSUQudGltZXN0YW1wLW1lc3NhZ2
VJRC5wYXJlbnQxLnRpbWVTdGFtcCA+MCIsInN0YXJ0Ijo0ODc0
LCJlbmQiOjQ5MzB9fSwiY29tbWVudHMiOnsiWFdDN3JDV1d1OX
NFM1I4diI6eyJkaXNjdXNzaW9uSWQiOiJra0VvZ1ZoeHBPa1pW
cldFIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiVGhpcy
BpcyBhIHN0cm9uZyBhc3N1bXB0aW9uIGFuZCBtYXkgYmUgaW50
ZXJwcmV0ZWQgaW4gYSB3cm9uZyB3YXkuIFdoYXQgaGFwcGVucy
BvZiBvbmUgbWVzc2FnZSBpcyBub3QgZGVsaXZlcmVkIG9uIHRp
bWU/IFByb3RvY29sIGJyZWFrcz8iLCJjcmVhdGVkIjoxNTk1NT
cyNjI0OTMzfSwiSWM5c2Z3eVZwOXh2UlhmSSI6eyJkaXNjdXNz
aW9uSWQiOiJNUk1qZXJqaHk0YllHRWtvIiwic3ViIjoiZ2g6NT
ExMTI2MTgiLCJ0ZXh0IjoiSXMgdGhpcyB0aGUgTWVzc2FnZSBJ
bmJveCBmcm9tIDEtMyA/IiwiY3JlYXRlZCI6MTU5NTU3Mjc1NT
M2MX0sIkFRZzJtaXI2dVhwQ09JMTYiOnsiZGlzY3Vzc2lvbklk
IjoiTVJNamVyamh5NGJZR0VrbyIsInN1YiI6ImdoOjUxMTEyNj
E4IiwidGV4dCI6IlByb2JhYmx5IG9ubHkgdGhlIHN1YnNldCB0
aGF0IGlzIG5vbi1lbGlnaWJsZS4iLCJjcmVhdGVkIjoxNTk1NT
cyNzkzNjkzfSwiRllYVVc3VU9ZNWVvc0pCaiI6eyJkaXNjdXNz
aW9uSWQiOiJYSFd0bXE5bjBsY1VQSHluIiwic3ViIjoiZ2g6NT
ExMTI2MTgiLCJ0ZXh0IjoibWVzc2FnZUlEPyIsImNyZWF0ZWQi
OjE1OTU1NzI5ODY4MTd9LCJheVRaa1BrN3JZdE5iQVpDIjp7Im
Rpc2N1c3Npb25JZCI6ImxXTURhaTRXbEM5R3ZwZXEiLCJzdWIi
OiJnaDo1MTExMjYxOCIsInRleHQiOiJub3QgY2xlYXIgd2l0aG
91dCBrbm93aW5nIHdoYXQgaXQgaXMgYWxyZWFkeSIsImNyZWF0
ZWQiOjE1OTU1NzM0NDAyNTN9LCJBZ0ZOTlhIa3FNTGdXNTNrIj
p7ImRpc2N1c3Npb25JZCI6IkhxZFdXRFRQa3hPMm90dVoiLCJz
dWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJkb24gdCB1bmRlcn
N0YW5kIiwiY3JlYXRlZCI6MTU5NTU3MzQ3OTEwOH0sIkJZTlB1
dURaVUxKVVI2QWUiOnsiZGlzY3Vzc2lvbklkIjoiaE5DS1REZG
UzOGF1NVl1dSIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6
IlN0cmljdGx5IHNwZWFraW5nIHRoaXMgaXMgbm90IGEgdGltZS
wgbW9yZSBhIHBvaW50IGluIHRpbWUgKHdlIGJlbGlldmUgdG8g
bGl2ZSBpbikuIFVOSVgtdGltZT8iLCJjcmVhdGVkIjoxNTk1NT
c0NTMyODczfSwiWlB2dW9GTGdWclVtWDJiRyI6eyJkaXNjdXNz
aW9uSWQiOiJZWk9nN3pjMXJiT0dmbGRaIiwic3ViIjoiZ2g6NT
ExMTI2MTgiLCJ0ZXh0Ijoid2hlcmUgd2lsbCB0aGV5IGJlIHN0
b3JlZD8iLCJjcmVhdGVkIjoxNTk1NTc0NjM2NTc5fSwiS2k2bW
Rpb1BTR2lPS2pzVyI6eyJkaXNjdXNzaW9uSWQiOiI4Wm1DRXNp
aHpYSkZNOTEyIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ij
oibWFrZSBjb25zaXN0ZW50OyBzdGFydCB1cHBlciBvciBsb3dl
ciBjYXNlIGFmdGVyICcgJywgb3IgdXNlIDogPyIsImNyZWF0ZW
QiOjE1OTU1NzQ3NjcwNTl9LCJxM09ROUJvZ280OGhVNFRwIjp7
ImRpc2N1c3Npb25JZCI6IjhabUNFc2loelhKRk05MTIiLCJzdW
IiOiJnaDo1MTExMjYxOCIsInRleHQiOiJ1c2UgdGhlIHNhbWUg
dGhyb3VnaG91dCB0aGUgc3BlY3MiLCJjcmVhdGVkIjoxNTk1NT
c0ODEyNzE2fSwidllqMzRVekhGdE91a0hzSCI6eyJkaXNjdXNz
aW9uSWQiOiJPcVlkcllzeWFyYkhvWUVnIiwic3ViIjoiZ2g6NT
ExMTI2MTgiLCJ0ZXh0IjoiY3VycmVudCBsb2NhbCB0aW1lPyIs
ImNyZWF0ZWQiOjE1OTU1NzUwMDkyNjV9LCJhYVI1M1JiWmpyYU
5RaGpvIjp7ImRpc2N1c3Npb25JZCI6Ik9xWWRyWXN5YXJiSG9Z
RWciLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJpZiBpdC
ByZWZlcnMgdG8gdGhlIHZhcmlhYmxlIGBjdXJyZW50IHRpbWVg
YWRkIHRoZXNlIGBzIiwiY3JlYXRlZCI6MTU5NTU3NTA4NjM5OX
0sInZLR0FFYzdFZDNETDNDNXMiOnsiZGlzY3Vzc2lvbklkIjoi
TFJzdUxwS2NvMjBUbFRlMyIsInN1YiI6ImdoOjUxMTEyNjE4Ii
widGV4dCI6IkJUVyB3aGVyZSBpcyBpdCBzcGVjaWZpZWQgaG93
IHRvIGNob29zZSB3IGFuZCB0aGUgb3RoZXIgcGFyYW1ldGVycz
8iLCJjcmVhdGVkIjoxNTk1NTc1MTQzNDM3fSwiVHAzUHhZVW1O
OERwdXZlayI6eyJkaXNjdXNzaW9uSWQiOiJmUmdzRlpuclRjZm
UyNGIzIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiSXMg
dGhpcyBhZnRlciB0aGUgbWVzc2FnZSBwYXNzZWQgdGhlIHJhdG
UgbWFuYWdlcj8gSWYgeWVzLCBJIG0gYSBiaXQgY29uZnVzZWQs
IG5vZGUgd2l0aCBkaWZmZXJlbnQgbWFuYSBwZXJjZXB0aW9uIG
1pZ2h0IGhhbmRsZSB0aGUgbWVzc2FnZSBkaWZmZXJlbnRseSIs
ImNyZWF0ZWQiOjE1OTU1NzU1NjMxNzB9LCJWNGRLYmZ3UTdQWE
JGSWM2Ijp7ImRpc2N1c3Npb25JZCI6Iko2aXJIckV1VWxSaU1S
MGUiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJEb2VzIH
RoaXMgY29tZSBiZWZvcmUgdGhlIGFib3ZlIHN0ZXAgb3IgYWZ0
ZXI/IEEgZ3JhcGggbGlrZSBpbiAxLTMgc2hvd2luZyB0aGUgcH
JvY2Vzc2VzIG1pZ2h0IGJlIGdvb2QiLCJjcmVhdGVkIjoxNTk1
NTc2MTI1NzMxfSwidzJxVThERFhDc1JndGRGSCI6eyJkaXNjdX
NzaW9uSWQiOiI3Q1FadjNZRnFpYnh4UHNVIiwic3ViIjoiZ2g6
NTExMTI2MTgiLCJ0ZXh0IjoiZnJvbSB3aGVyZT8gTWVzc2FnZS
BJbmJveD8gU3RpbGwgZ29zc2lwZWQgb3Igbm90PyIsImNyZWF0
ZWQiOjE1OTU1NzYxNTk0MDV9LCJMUHZVdERRNU9lbGs4eUM1Ij
p7ImRpc2N1c3Npb25JZCI6Iko2aXJIckV1VWxSaU1SMGUiLCJz
dWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJPciBpcyB0aGlzIG
NvbnRhaW5lZCBpbiB0aGUgdGltZXN0YW1wIGNoZWNrIGluIDEt
Mz8iLCJjcmVhdGVkIjoxNTk1NTc2Mjk2MjU2fSwiazNYRFhVUm
gxeXQ1aTd3VyI6eyJkaXNjdXNzaW9uSWQiOiJqU3dmT2NtWjNC
dWFqcm9TIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiZG
9uIHQgdW5kZXJzdGFuZD8gSXMgdGhpcyBnZXRUaXAgZm9yIG5l
dyBtZXNzYWdlLklEPyIsImNyZWF0ZWQiOjE1OTU1NzY5MjM2Mj
h9LCI1WHZzU0x6MHFuR3RmYXFiIjp7ImRpc2N1c3Npb25JZCI6
Im1lQ0VJcFo1eExNS3VjZ00iLCJzdWIiOiJnaDo1MTExMjYxOC
IsInRleHQiOiJ3aGVyZSBpcyB0aGlzIGRlZmluZWQ/IiwiY3Jl
YXRlZCI6MTU5NTU3NzE4MTI1OX0sIndldE82RkFPYWRiWTRaZW
UiOnsiZGlzY3Vzc2lvbklkIjoiRE9vbDdKSVhPT2JMRXRYRiIs
InN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IlRoaXMgc2hvdW
xkIGJlIGNhbGN1bGFibGUuIFVuZGVyIHNvbWUgYXNzdW1wdGlv
bnMgb2YgbWFsaWNpb3VzIG1wcyBhbmQgaG9uZXN0IG1wcyBldm
VuIHRoZW9yZXRpY2FsbHkuIiwiY3JlYXRlZCI6MTU5NTU3NzYz
MTc1Nn0sImxqd29TczdBT1pVNGVHM3EiOnsiZGlzY3Vzc2lvbk
lkIjoiS1VVUFduSDMxMFlQUDZuRCIsInN1YiI6ImdoOjUxMTEy
NjE4IiwidGV4dCI6IklzIHRoaXMgdGhlIGRlZmluaXRpb24gb2
YgY29uZmlkZW5jZSBsZXZlbD8iLCJjcmVhdGVkIjoxNTk1NTc3
OTY1MzMxfSwiZUtDSUVvU3cyOHFwVUtYTiI6eyJkaXNjdXNzaW
9uSWQiOiJnMk1GeDljQlpvaFNFd1FlIiwic3ViIjoiZ2g6NTEx
MTI2MTgiLCJ0ZXh0Ijoid2hlcmUgaXMgdGhpcyBkZWZpbmVkPy
IsImNyZWF0ZWQiOjE1OTU1NzgwMjg3MDF9LCJEVHFkaEExOGgx
d3BSd251Ijp7ImRpc2N1c3Npb25JZCI6ImVjUlQwdWc0T0xVdV
p6Y2MiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJpcyB0
aGVyZSBhIGNoYW5jZSB0aGF0IGEgbWVzc2FnZSBnZXRzIHRyYX
BwZWQgaW4gdGhlIE1lc3NhZ2UgSW5ib3ggYW5kIGhhcyB0byBi
ZSByZW1vdmVkIHRvbz8iLCJjcmVhdGVkIjoxNTk1NTc4NDg4NT
UxfSwiYmVvOTR3dWNXWmlMR2FKWiI6eyJkaXNjdXNzaW9uSWQi
OiJDTnNYQnZBM0R6OElnNlhpIiwic3ViIjoiZ2g6NTExMTI2MT
giLCJ0ZXh0IjoiV2hhdCBoYXBwZW5zIGlmIGVsaWdpYmxlVGlw
c0xpc3QgaXMgZW1wdHkgZm9yIGFsbCBub2Rlcz8gU2hvdWxkIG
50IHdlIHRoaW5rIGFib3V0IGhhbmRsaW5nIHRoaXMgY2FzZT8i
LCJjcmVhdGVkIjoxNTk1NTc4NjMxMTM2fSwickdUcjFWRjBtRl
FjamQyOCI6eyJkaXNjdXNzaW9uSWQiOiJMUnN1THBLY28yMFRs
VGUzIiwic3ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiVXN1YW
xseSBTZXJndWVpIHNheXMgXCJQdXQgYW55IHJlYXNvbmFibGUg
aW5pdGlhbCBwYXJhbWV0ZXIgYW5kIHdlIGNoYW5nZSBhZnRlci
B0ZXN0aW5nXCIuIiwiY3JlYXRlZCI6MTU5NTg3OTM3NzcwMH0s
ImU3SllaRGlQcGszR3hqQWUiOnsiZGlzY3Vzc2lvbklkIjoiSj
ZpckhyRXVVbFJpTVIwZSIsInN1YiI6ImdoOjY4MjUwMzUwIiwi
dGV4dCI6IkZyb20gdGhlIGxhc3QgZGlzY3Vzc2lvbiBmcm9tIH
RoZSBncm91cCwgQk1EIGNoZWNrIGlzIHBhcnQgb2Ygc29saWRp
ZmljYXRpb24sIHBlaGFwcyB3ZSBuZWVkIHRvIGNoYW5nZSBzZX
NzaW9ucyB0byByZWZsZWN0IHRoaXM/IEkgd2lsbCBkaXNjdXNz
IHRoaXMgaW4gdGhlIHByb3RvY29sIGNhbGwgdG9tb3Jyb3chIi
wiY3JlYXRlZCI6MTU5NTg3OTcwMjM3Mn0sImoycWpvS2E1NW9C
QTYzOXMiOnsiZGlzY3Vzc2lvbklkIjoiUktxOWVrbXVVa1V3SH
hldSIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4dCI6IlJlcGVh
dGVkIFwiTW9yZW92ZXJcIiwgdXNlIG90aGVyIHdvcmQgbGlrZS
BcIkFkZGl0aW9uYWxseVwiIiwiY3JlYXRlZCI6MTU5NTg4MDA0
MjU2MX0sIkVSNG1LQnBFN01hMlQ1NmUiOnsiZGlzY3Vzc2lvbk
lkIjoibEJ2Z3RiR2FCVHZmVlNZZyIsInN1YiI6ImdoOjY4MjUw
MzUwIiwidGV4dCI6IklPVEEiLCJjcmVhdGVkIjoxNTk1ODgwMD
c0MjUzfSwiTFo0cmtaRlRjN3hmSTY5UiI6eyJkaXNjdXNzaW9u
SWQiOiJVc1BsWkUxWEF1czA3U0wwIiwic3ViIjoiZ2g6NjgyNT
AzNTAiLCJ0ZXh0IjoiSXMgaXQgb2sgdG8gdXNlIHRoZSBtYXRo
ZW1hdGljYWwgdGVybWlub2xvZ3kgaGVyZT8iLCJjcmVhdGVkIj
oxNTk1ODgwNzQwNTAxfSwicHV5SERjZjJVZlZuZHJvQiI6eyJk
aXNjdXNzaW9uSWQiOiJQSkJ4d0pmYU1DMGMwSzZpIiwic3ViIj
oiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiV2UgbmVlZCB0byBkZWZp
bmUgYXR0YWNrcyBzb21ld2hlcmUuIEFsc28sIGRvZXMgaXQgbW
FrZSBzZW5zZSB0byBoYXZlIGEgYmxvd2JhbGwgYXR0YWNrIHdp
dGggbm8gbWlsZXN0b25lcz8iLCJjcmVhdGVkIjoxNTk1ODgwOD
AzMzg4fSwiT3lEUHlzck1KY2MwZW5WbiI6eyJkaXNjdXNzaW9u
SWQiOiJpU2FNTG1zTTZlTUtDanhKIiwic3ViIjoiZ2g6NjgyNT
AzNTAiLCJ0ZXh0IjoiSSBiZWxpZXZlIHdlIGNhbiBiZSBwcmVj
aXNlIGhlcmUgd2l0aCBzb21lIG1hdGggZnJvbSBUUy4uLiIsIm
NyZWF0ZWQiOjE1OTU4ODA4NjgwNDl9LCJ1NlNwT0dkWUE5anZn
bnJEIjp7ImRpc2N1c3Npb25JZCI6IndOR3d0OHQzanh4NGtaVz
MiLCJzdWIiOiJnaDo2ODI1MDM1MCIsInRleHQiOiJJc24ndCBj
aGVja2luZyBwYXN0IGNvbmUganVzdCBhcyBleHBlbnNpdmU/Ii
wiY3JlYXRlZCI6MTU5NTg4MDkxMzgxMX0sInRMcUROb2NOdEoy
V09KRkYiOnsiZGlzY3Vzc2lvbklkIjoiZ1ZFSkI1dUpJcGNFeE
0zcyIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4dCI6IlBlaGFw
cyBhIHNlY3Rpb24gZGVzY3JpYmluZyBwb3NzaWJsZSBhdHRhY2
tzIHdvdWxkIG1pa2UgdGhlIGZpbGUgY2xlYW5lciIsImNyZWF0
ZWQiOjE1OTU4ODExMTE1Njd9LCJSTWkwTXJRUkpUcEVSQWc0Ij
p7ImRpc2N1c3Npb25JZCI6IkdOYkQ3SmhVdHg5aGNYcVMiLCJz
dWIiOiJnaDo2ODI1MDM1MCIsInRleHQiOiJXZSBuZWVkIHRvIG
RlZmluZSB0aGUgdGVybSBcIm9ycGhhbmFnZVwiIGJlZm9yZSB1
c2luZyBpdCIsImNyZWF0ZWQiOjE1OTU4ODEzODU1MjR9LCJuZ2
1pUkhPUGxMWVEwNlVsIjp7ImRpc2N1c3Npb25JZCI6Im5xRjdj
bGNYOFB2cjlubFUiLCJzdWIiOiJnaDo2ODI1MDM1MCIsInRleH
QiOiJGb2xsb3dpbmcgU2ViYXN0aWFucyBDb21tZW50cyBJIHdv
dWxkIHN1Z2dlc3QgdGhpcyBzZWN0aW9uIHRvIGNvbWUgYmVmb3
JlLCBzaW5jZSB3ZSBtYW55IHRpbWVzIHRhbGsgYWJvdXQgb3Jw
aGFuYWdlIGFuZCBmaW5hbGl0eSBiZWZvcmUuIiwiY3JlYXRlZC
I6MTU5NTg4MjIzODI3MH0sIjRjTTJFOEFnQWxsMDM0N2IiOnsi
ZGlzY3Vzc2lvbklkIjoiR0Z6Y3REUVJ5RmZ6eTl2eCIsInN1Yi
I6ImdoOjY4MjUwMzUwIiwidGV4dCI6IlRoaXMgc2hvdWxkIGlu
ZHVjZSBhIG5ldyBwYXJhbWV0ZXIiLCJjcmVhdGVkIjoxNTk1OD
k3MjQ4MzA2fSwiUDY1b0VzQURXb2dMdnFrRSI6eyJkaXNjdXNz
aW9uSWQiOiI1MjZ3MTBCOVF4TDdkR1lmIiwic3ViIjoiZ2g6Nj
gyNTAzNTAiLCJ0ZXh0IjoiV2UgaW5pdGlhbGx5IGludHJvZHVj
ZWQgNCBncmFkZXMsIHNvIHdlIGNvdWxkIGhhdmUgb25lIGtpbm
Qgb2YgZmluYWxpdHkgaW4gc29tZSBzZWNvbmRzICh0aGUgc21h
bGwgbmV0d29yayBkZWxheSB3aXRoIG5vIGNvbmZsaWN0cyksIE
kgZmVlbCBsaWtlIGNoYW5naW5nIGl0IGlzIGJhZCBmb3IgUFIu
IiwiY3JlYXRlZCI6MTU5NTg5Nzk4MzgzMH0sIlhrbXVKZ0tqSE
hnZGs2MkciOnsiZGlzY3Vzc2lvbklkIjoiTXJ3MUlHbnBaQkNi
SkRMaiIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4dCI6IjoiLC
JjcmVhdGVkIjoxNTk1ODk4MDQwNTM2fSwiM0h4RXNkdVFzMVVx
TG5aQiI6eyJkaXNjdXNzaW9uSWQiOiJ1Y3FTcWpGTFhQdnN1Vk
dUIiwic3ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiU2hvdWxk
bid0IHRoaXMgYmUgaW4gcHNldWRvLUFsZ29yaXRobT8iLCJjcm
VhdGVkIjoxNTk1ODk4ODA5MTcxfSwicUZSc3JobTlGSUphdHZO
VCI6eyJkaXNjdXNzaW9uSWQiOiJsVTl2N0Z3MnRXSEtLbk9jIi
wic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiSW4gcGFydGlj
dWxhciwgdGhpcyBlbmZvcmNlcyBtb25vdG9uaWNpdHkgb2YgdG
ltZXN0YW1wcywgXCI+MFwiLCBUaGlzIGlzIHNvbWVob3cgaGlk
ZGVuIGhlcmUgYW5kIHNob3VsZCBiZSBtb3ZlZCB0byBUaW1lc3
RhbXBDaGVjayIsImNyZWF0ZWQiOjE1OTU5MTUyODAwNDl9LCJO
bW5aMDFtYk9COEd0WEtiIjp7ImRpc2N1c3Npb25JZCI6ImtrRW
9nVmh4cE9rWlZyV0UiLCJzdWIiOiJnaDo1MDY2MTg0NCIsInRl
eHQiOiJCYXNpY2FsbHkuICBBIG5vZGUgaXMgdGhyb3duIG91dC
BvZiBzeW5jLiIsImNyZWF0ZWQiOjE1OTU5MjUwNjE0Njh9LCJN
TldoNW8yeEFsV2tuTkUwIjp7ImRpc2N1c3Npb25JZCI6ImxXTU
RhaTRXbEM5R3ZwZXEiLCJzdWIiOiJnaDo1MDY2MTg0NCIsInRl
eHQiOiJJbSBub3Qgc3VyZSBob3cgdG8gZGVmaW5lIGl0IGluIG
NvbmNpc2Ugd2F5LiIsImNyZWF0ZWQiOjE1OTU5MjUxMTA2Njh9
LCJRSEx6MVRFQ2tDRXN6U0E5Ijp7ImRpc2N1c3Npb25JZCI6Ik
1STWplcmpoeTRiWUdFa28iLCJzdWIiOiJnaDo1MDY2MTg0NCIs
InRleHQiOiJUaGUgZWxpZ2liaWxpdHkgc3RhdHVzIGlzIHBlbm
RpbmciLCJjcmVhdGVkIjoxNTk1OTI1MjA5NjQyfSwiSHV0NGtP
V29ONzJWcFU2NyI6eyJkaXNjdXNzaW9uSWQiOiJYSFd0bXE5bj
BsY1VQSHluIiwic3ViIjoiZ2g6NTA2NjE4NDQiLCJ0ZXh0Ijoi
VGhpcyBoYXMgdG8gYmUgZGVmaW5lZCBpbiBhbm90aGVyIHNwZW
NpZmljYXRpb246IHRoZSBoYXNoIG9mIGVhY2ggbWVzc2FnZSBp
cyB0aGUgTWVzc2FnZUlEIiwiY3JlYXRlZCI6MTU5NTkyNTI1Nj
I0Nn0sIjN5ak4wVW1Menc1U21JRzIiOnsiZGlzY3Vzc2lvbklk
IjoiaE5DS1REZGUzOGF1NVl1dSIsInN1YiI6ImdoOjUwNjYxOD
Q0IiwidGV4dCI6IkkgdGhpbmsgaXQgd2lsbCBiZSBVTklYIHRp
bWUiLCJjcmVhdGVkIjoxNTk1OTI1Mjg3MzA2fSwiN2g5THhVQk
VHbnR3UVZPMiI6eyJkaXNjdXNzaW9uSWQiOiJZWk9nN3pjMXJi
T0dmbGRaIiwic3ViIjoiZ2g6NTA2NjE4NDQiLCJ0ZXh0IjoiVG
hhdCBpcyBiZXlvbmQgdGhlIHNjb3BlIG9mIHRoaXMgZG9jdW1l
bnQiLCJjcmVhdGVkIjoxNTk1OTI1MzM4ODE4fSwielRTaUhmMT
NIbFZpaEVpNCI6eyJkaXNjdXNzaW9uSWQiOiI4Wm1DRXNpaHpY
SkZNOTEyIiwic3ViIjoiZ2g6NTA2NjE4NDQiLCJ0ZXh0IjoiSS
Bkb250IHVuZGVyc3RhbmQ/IiwiY3JlYXRlZCI6MTU5NTkyNTQz
OTg3OH19LCJoaXN0b3J5IjpbLTE3ODY2MTM4NDYsLTExMDIzMz
Q3OTRdfQ==
-->