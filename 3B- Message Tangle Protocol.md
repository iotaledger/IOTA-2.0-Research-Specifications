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

If this check returns `INVALID`, the message is considered invalid, deleted, and not gossiped.  

### Rationale

Suppose an incoming message has a parent with timestamp older than w+2D+Delta.  Then the message either has a timestamp which is bad level 3, or else it will fail the below max depth check.  In either case, the message will eventually be deleted. 

## 3. Tip selection

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

Randomly select messageID from eligibleTipsList
While (currentTime-messageId.timeStamp<Delta) is FALSE
    Randomly select messageID from eligibleTipsList
EndWhile
Return messageID
```


### Rationale

RURTS is easy to implement, computationally inexpensive, and minimiszes orphanage. Moreover, it is in weak Nash equilibrium: honest users have nothing to gain by deviating from the protocol. Additionally, this tip selection algorithm should be resistant to blow ball attacks.  

As demonstrated in the original Iota white paper and subsequent simulations, URTS has no orphans.  Theoretically, RURTS should largely approximate URTS.  The only difference is that some tips may "expire" when they become older than `Delta`.  With a large `Delta`, honest messages will essentially never be orphaned. 

A message disliked by FPC will not be added to `eligibleTipsList` and thus will be orphaned.  Moreover, a message will be orphaned if some message in its past cone is disliked by FPC.  In this way, the algorithms enforce monotonicity in FPC voting, without traversing the tangle marking flags.

Since messages with questionable timestamps will not be flagged eligible until FPC resolves their status, honest messages should not approve them.  Thus, an attacker cannot trick honest messages into being orphaned.

It is necessary that `Delta>w+D` in order to prevent the following attack.  Suppose `w=30`, `D=5`, and `Delta=5`.  Given these parameters, an attacker can maintain a chain of messages whose tip always has a timestamp between `currentTime-10` and `currentTime-15`,   because the timestamps in this interval will always be valid. However, the confirmation confidence (the probability of selecting a tip that is an indirect approver) of every message in this chain will always be `0` because each message is older than `Delta`.  At anytime, the attacker can orphan the entire chain by ceasing issueing messages, but the attacker can also  have the chain reach full confirmation confidence by issueing tips with current timestamps. Thus the status of this chain is indeterminable: the messages are neither "in" nor "out" of the ledger.  This is effectively a liveness attack.  

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
OjQ3NzIsImVuZCI6NDgyNH0sImpTd2ZPY21aM0J1YWpyb1MiOn
sidGV4dCI6ImN1cnJlbnRUaW1lLW1lc3NhZ2VJZC50aW1lU3Rh
bXA8RGVsdGEiLCJzdGFydCI6NzAyNywiZW5kIjo3MDY0fSwibW
VDRUlwWjV4TE1LdWNnTSI6eyJ0ZXh0IjoiY29uZmlybWF0aW9u
IGNvbmZpZGVuY2UiLCJzdGFydCI6ODYyNSwiZW5kIjo4NjQ4fS
wiRE9vbDdKSVhPT2JMRXRYRiI6eyJ0ZXh0IjoiV2Uga25vdyBm
b3IgaW5zdGFuY2UgdGhlIHByb2JhYmlsaXR5IG9mIGJlaW5nIG
9ycGhhbmVkIGlzIFwic21hbGxcIiwgYnV0IHdlIGRvIG5v4oCm
Iiwic3RhcnQiOjExMzExLCJlbmQiOjExNDQxfSwiS1VVUFduSD
MxMFlQUDZuRCI6eyJ0ZXh0IjoiY29uZmlybWF0aW9uQ29uZmlk
ZW5jIiwic3RhcnQiOjEyNzc4LCJlbmQiOjEyNzk5fSwiZzJNRn
g5Y0Jab2hTRXdRZSI6eyJ0ZXh0IjoiUmVjYWxsIHQiLCJzdGFy
dCI6MTMxNDcsImVuZCI6MTMxNTV9LCJlY1JUMHVnNE9MVXVaem
NjIjp7InRleHQiOiJoZSBmb2xsb3dpbmciLCJzdGFydCI6MTUy
NTIsImVuZCI6MTUyNjR9LCJDTnNYQnZBM0R6OElnNlhpIjp7In
RleHQiOiJUaXBzIHNlbGVjdGlvbiIsInN0YXJ0Ijo1NDM0LCJl
bmQiOjU0NDd9LCJsQnZndGJHYUJUdmZWU1lnIjp7InRleHQiOi
JJb3RhIiwic3RhcnQiOjc0ODUsImVuZCI6NzQ4OX0sIlVzUGxa
RTFYQXVzMDdTTDAiOnsidGV4dCI6IndlYWsgTmFzaCBlcXVpbG
licml1bToiLCJzdGFydCI6NzI3NiwiZW5kIjo3Mjk4fSwiUEpC
eHdKZmFNQzBjMEs2aSI6eyJ0ZXh0IjoiYmxvdyBiYWxsIGF0dG
Fja3MiLCJzdGFydCI6NzQzMSwiZW5kIjo3NDQ4fSwiaVNhTUxt
c002ZU1LQ2p4SiI6eyJ0ZXh0IjoiV2l0aCBhIGxhcmdlIGBEZW
x0YWAsIGhvbmVzdCBtZXNzYWdlcyB3aWxsIGVzc2VudGlhbGx5
IG5ldmVyIGJlIG9ycGhhbmVkLiIsInN0YXJ0Ijo3Njk2LCJlbm
QiOjc3Njl9LCJnVkVKQjV1SklwY0V4TTNzIjp7InRleHQiOiJm
b2xsb3dpbmcgYXR0YWNrIiwic3RhcnQiOjgzNDEsImVuZCI6OD
M1N30sIkdOYkQ3SmhVdHg5aGNYcVMiOnsidGV4dCI6Im9ycGhh
bmVkIiwic3RhcnQiOjkzNjgsImVuZCI6OTM3Nn0sIm5xRjdjbG
NYOFB2cjlubFUiOnsidGV4dCI6IkZpbmFsaXR5Iiwic3RhcnQi
OjExNDUzLCJlbmQiOjExNDYxfSwiR0Z6Y3REUVJ5RmZ6eTl2eC
I6eyJ0ZXh0IjoiUGVyaW9kaWNhbGx5Iiwic3RhcnQiOjYyNTQs
ImVuZCI6NjI2Nn0sIjUyNncxMEI5UXhMN2RHWWYiOnsidGV4dC
I6IkdyYWRlIDEiLCJzdGFydCI6MTIzMDIsImVuZCI6MTIzMDl9
LCJNcncxSUducFpCQ2JKRExqIjp7InRleHQiOiIuIiwic3Rhcn
QiOjE0MTM1LCJlbmQiOjE0MTM2fSwidWNxU3FqRkxYUHZzdVZH
VCI6eyJ0ZXh0IjoiUmVtb3ZlIG1lc3NhZ2VJRCBmcm9tIGBwZW
5kaW5nYCBpZiBwcmVzZW50XG4qIFJlbW92ZSBtZXNzYWdlSUQg
ZnJvbSBgZWxpZ2libGVUaXDigKYiLCJzdGFydCI6MTUyNjgsIm
VuZCI6MTU0MDV9LCJsVTl2N0Z3MnRXSEtLbk9jIjp7InRleHQi
OiJEZWx0YT5tZXNzYWdlSUQudGltZXN0YW1wLW1lc3NhZ2VJRC
5wYXJlbnQxLnRpbWVTdGFtcCA+MCIsInN0YXJ0Ijo0ODc0LCJl
bmQiOjQ5MzB9fSwiY29tbWVudHMiOnsiWFdDN3JDV1d1OXNFM1
I4diI6eyJkaXNjdXNzaW9uSWQiOiJra0VvZ1ZoeHBPa1pWcldF
Iiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiVGhpcyBpcy
BhIHN0cm9uZyBhc3N1bXB0aW9uIGFuZCBtYXkgYmUgaW50ZXJw
cmV0ZWQgaW4gYSB3cm9uZyB3YXkuIFdoYXQgaGFwcGVucyBvZi
BvbmUgbWVzc2FnZSBpcyBub3QgZGVsaXZlcmVkIG9uIHRpbWU/
IFByb3RvY29sIGJyZWFrcz8iLCJjcmVhdGVkIjoxNTk1NTcyNj
I0OTMzfSwiSWM5c2Z3eVZwOXh2UlhmSSI6eyJkaXNjdXNzaW9u
SWQiOiJNUk1qZXJqaHk0YllHRWtvIiwic3ViIjoiZ2g6NTExMT
I2MTgiLCJ0ZXh0IjoiSXMgdGhpcyB0aGUgTWVzc2FnZSBJbmJv
eCBmcm9tIDEtMyA/IiwiY3JlYXRlZCI6MTU5NTU3Mjc1NTM2MX
0sIkFRZzJtaXI2dVhwQ09JMTYiOnsiZGlzY3Vzc2lvbklkIjoi
TVJNamVyamh5NGJZR0VrbyIsInN1YiI6ImdoOjUxMTEyNjE4Ii
widGV4dCI6IlByb2JhYmx5IG9ubHkgdGhlIHN1YnNldCB0aGF0
IGlzIG5vbi1lbGlnaWJsZS4iLCJjcmVhdGVkIjoxNTk1NTcyNz
kzNjkzfSwiRllYVVc3VU9ZNWVvc0pCaiI6eyJkaXNjdXNzaW9u
SWQiOiJYSFd0bXE5bjBsY1VQSHluIiwic3ViIjoiZ2g6NTExMT
I2MTgiLCJ0ZXh0IjoibWVzc2FnZUlEPyIsImNyZWF0ZWQiOjE1
OTU1NzI5ODY4MTd9LCJheVRaa1BrN3JZdE5iQVpDIjp7ImRpc2
N1c3Npb25JZCI6ImxXTURhaTRXbEM5R3ZwZXEiLCJzdWIiOiJn
aDo1MTExMjYxOCIsInRleHQiOiJub3QgY2xlYXIgd2l0aG91dC
Brbm93aW5nIHdoYXQgaXQgaXMgYWxyZWFkeSIsImNyZWF0ZWQi
OjE1OTU1NzM0NDAyNTN9LCJBZ0ZOTlhIa3FNTGdXNTNrIjp7Im
Rpc2N1c3Npb25JZCI6IkhxZFdXRFRQa3hPMm90dVoiLCJzdWIi
OiJnaDo1MTExMjYxOCIsInRleHQiOiJkb24gdCB1bmRlcnN0YW
5kIiwiY3JlYXRlZCI6MTU5NTU3MzQ3OTEwOH0sIkJZTlB1dURa
VUxKVVI2QWUiOnsiZGlzY3Vzc2lvbklkIjoiaE5DS1REZGUzOG
F1NVl1dSIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IlN0
cmljdGx5IHNwZWFraW5nIHRoaXMgaXMgbm90IGEgdGltZSwgbW
9yZSBhIHBvaW50IGluIHRpbWUgKHdlIGJlbGlldmUgdG8gbGl2
ZSBpbikuIFVOSVgtdGltZT8iLCJjcmVhdGVkIjoxNTk1NTc0NT
MyODczfSwiWlB2dW9GTGdWclVtWDJiRyI6eyJkaXNjdXNzaW9u
SWQiOiJZWk9nN3pjMXJiT0dmbGRaIiwic3ViIjoiZ2g6NTExMT
I2MTgiLCJ0ZXh0Ijoid2hlcmUgd2lsbCB0aGV5IGJlIHN0b3Jl
ZD8iLCJjcmVhdGVkIjoxNTk1NTc0NjM2NTc5fSwiS2k2bWRpb1
BTR2lPS2pzVyI6eyJkaXNjdXNzaW9uSWQiOiI4Wm1DRXNpaHpY
SkZNOTEyIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoibW
FrZSBjb25zaXN0ZW50OyBzdGFydCB1cHBlciBvciBsb3dlciBj
YXNlIGFmdGVyICcgJywgb3IgdXNlIDogPyIsImNyZWF0ZWQiOj
E1OTU1NzQ3NjcwNTl9LCJxM09ROUJvZ280OGhVNFRwIjp7ImRp
c2N1c3Npb25JZCI6IjhabUNFc2loelhKRk05MTIiLCJzdWIiOi
JnaDo1MTExMjYxOCIsInRleHQiOiJ1c2UgdGhlIHNhbWUgdGhy
b3VnaG91dCB0aGUgc3BlY3MiLCJjcmVhdGVkIjoxNTk1NTc0OD
EyNzE2fSwidllqMzRVekhGdE91a0hzSCI6eyJkaXNjdXNzaW9u
SWQiOiJPcVlkcllzeWFyYkhvWUVnIiwic3ViIjoiZ2g6NTExMT
I2MTgiLCJ0ZXh0IjoiY3VycmVudCBsb2NhbCB0aW1lPyIsImNy
ZWF0ZWQiOjE1OTU1NzUwMDkyNjV9LCJhYVI1M1JiWmpyYU5RaG
pvIjp7ImRpc2N1c3Npb25JZCI6Ik9xWWRyWXN5YXJiSG9ZRWci
LCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJpZiBpdCByZW
ZlcnMgdG8gdGhlIHZhcmlhYmxlIGBjdXJyZW50IHRpbWVgYWRk
IHRoZXNlIGBzIiwiY3JlYXRlZCI6MTU5NTU3NTA4NjM5OX0sIn
ZLR0FFYzdFZDNETDNDNXMiOnsiZGlzY3Vzc2lvbklkIjoiTFJz
dUxwS2NvMjBUbFRlMyIsInN1YiI6ImdoOjUxMTEyNjE4IiwidG
V4dCI6IkJUVyB3aGVyZSBpcyBpdCBzcGVjaWZpZWQgaG93IHRv
IGNob29zZSB3IGFuZCB0aGUgb3RoZXIgcGFyYW1ldGVycz8iLC
JjcmVhdGVkIjoxNTk1NTc1MTQzNDM3fSwiVHAzUHhZVW1OOERw
dXZlayI6eyJkaXNjdXNzaW9uSWQiOiJmUmdzRlpuclRjZmUyNG
IzIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiSXMgdGhp
cyBhZnRlciB0aGUgbWVzc2FnZSBwYXNzZWQgdGhlIHJhdGUgbW
FuYWdlcj8gSWYgeWVzLCBJIG0gYSBiaXQgY29uZnVzZWQsIG5v
ZGUgd2l0aCBkaWZmZXJlbnQgbWFuYSBwZXJjZXB0aW9uIG1pZ2
h0IGhhbmRsZSB0aGUgbWVzc2FnZSBkaWZmZXJlbnRseSIsImNy
ZWF0ZWQiOjE1OTU1NzU1NjMxNzB9LCJWNGRLYmZ3UTdQWEJGSW
M2Ijp7ImRpc2N1c3Npb25JZCI6Iko2aXJIckV1VWxSaU1SMGUi
LCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJEb2VzIHRoaX
MgY29tZSBiZWZvcmUgdGhlIGFib3ZlIHN0ZXAgb3IgYWZ0ZXI/
IEEgZ3JhcGggbGlrZSBpbiAxLTMgc2hvd2luZyB0aGUgcHJvY2
Vzc2VzIG1pZ2h0IGJlIGdvb2QiLCJjcmVhdGVkIjoxNTk1NTc2
MTI1NzMxfSwiTFB2VXREUTVPZWxrOHlDNSI6eyJkaXNjdXNzaW
9uSWQiOiJKNmlySHJFdVVsUmlNUjBlIiwic3ViIjoiZ2g6NTEx
MTI2MTgiLCJ0ZXh0IjoiT3IgaXMgdGhpcyBjb250YWluZWQgaW
4gdGhlIHRpbWVzdGFtcCBjaGVjayBpbiAxLTM/IiwiY3JlYXRl
ZCI6MTU5NTU3NjI5NjI1Nn0sImszWERYVVJoMXl0NWk3d1ciOn
siZGlzY3Vzc2lvbklkIjoialN3Zk9jbVozQnVhanJvUyIsInN1
YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6ImRvbiB0IHVuZGVyc3
RhbmQ/IElzIHRoaXMgZ2V0VGlwIGZvciBuZXcgbWVzc2FnZS5J
RD8iLCJjcmVhdGVkIjoxNTk1NTc2OTIzNjI4fSwiNVh2c1NMej
Bxbkd0ZmFxYiI6eyJkaXNjdXNzaW9uSWQiOiJtZUNFSXBaNXhM
TUt1Y2dNIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ijoid2
hlcmUgaXMgdGhpcyBkZWZpbmVkPyIsImNyZWF0ZWQiOjE1OTU1
NzcxODEyNTl9LCJ3ZXRPNkZBT2FkYlk0WmVlIjp7ImRpc2N1c3
Npb25JZCI6IkRPb2w3SklYT09iTEV0WEYiLCJzdWIiOiJnaDo1
MTExMjYxOCIsInRleHQiOiJUaGlzIHNob3VsZCBiZSBjYWxjdW
xhYmxlLiBVbmRlciBzb21lIGFzc3VtcHRpb25zIG9mIG1hbGlj
aW91cyBtcHMgYW5kIGhvbmVzdCBtcHMgZXZlbiB0aGVvcmV0aW
NhbGx5LiIsImNyZWF0ZWQiOjE1OTU1Nzc2MzE3NTZ9LCJsandv
U3M3QU9aVTRlRzNxIjp7ImRpc2N1c3Npb25JZCI6IktVVVBXbk
gzMTBZUFA2bkQiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQi
OiJJcyB0aGlzIHRoZSBkZWZpbml0aW9uIG9mIGNvbmZpZGVuY2
UgbGV2ZWw/IiwiY3JlYXRlZCI6MTU5NTU3Nzk2NTMzMX0sImVL
Q0lFb1N3MjhxcFVLWE4iOnsiZGlzY3Vzc2lvbklkIjoiZzJNRn
g5Y0Jab2hTRXdRZSIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4
dCI6IndoZXJlIGlzIHRoaXMgZGVmaW5lZD8iLCJjcmVhdGVkIj
oxNTk1NTc4MDI4NzAxfSwiRFRxZGhBMThoMXdwUndudSI6eyJk
aXNjdXNzaW9uSWQiOiJlY1JUMHVnNE9MVXVaemNjIiwic3ViIj
oiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiaXMgdGhlcmUgYSBjaGFu
Y2UgdGhhdCBhIG1lc3NhZ2UgZ2V0cyB0cmFwcGVkIGluIHRoZS
BNZXNzYWdlIEluYm94IGFuZCBoYXMgdG8gYmUgcmVtb3ZlZCB0
b28/IiwiY3JlYXRlZCI6MTU5NTU3ODQ4ODU1MX0sImJlbzk0d3
VjV1ppTEdhSloiOnsiZGlzY3Vzc2lvbklkIjoiQ05zWEJ2QTNE
ejhJZzZYaSIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Il
doYXQgaGFwcGVucyBpZiBlbGlnaWJsZVRpcHNMaXN0IGlzIGVt
cHR5IGZvciBhbGwgbm9kZXM/IFNob3VsZCBudCB3ZSB0aGluay
BhYm91dCBoYW5kbGluZyB0aGlzIGNhc2U/IiwiY3JlYXRlZCI6
MTU5NTU3ODYzMTEzNn0sInJHVHIxVkYwbUZRY2pkMjgiOnsiZG
lzY3Vzc2lvbklkIjoiTFJzdUxwS2NvMjBUbFRlMyIsInN1YiI6
ImdoOjY4MjUwMzUwIiwidGV4dCI6IlVzdWFsbHkgU2VyZ3VlaS
BzYXlzIFwiUHV0IGFueSByZWFzb25hYmxlIGluaXRpYWwgcGFy
YW1ldGVyIGFuZCB3ZSBjaGFuZ2UgYWZ0ZXIgdGVzdGluZ1wiLi
IsImNyZWF0ZWQiOjE1OTU4NzkzNzc3MDB9LCJlN0pZWkRpUHBr
M0d4akFlIjp7ImRpc2N1c3Npb25JZCI6Iko2aXJIckV1VWxSaU
1SMGUiLCJzdWIiOiJnaDo2ODI1MDM1MCIsInRleHQiOiJGcm9t
IHRoZSBsYXN0IGRpc2N1c3Npb24gZnJvbSB0aGUgZ3JvdXAsIE
JNRCBjaGVjayBpcyBwYXJ0IG9mIHNvbGlkaWZpY2F0aW9uLCBw
ZWhhcHMgd2UgbmVlZCB0byBjaGFuZ2Ugc2Vzc2lvbnMgdG8gcm
VmbGVjdCB0aGlzPyBJIHdpbGwgZGlzY3VzcyB0aGlzIGluIHRo
ZSBwcm90b2NvbCBjYWxsIHRvbW9ycm93ISIsImNyZWF0ZWQiOj
E1OTU4Nzk3MDIzNzJ9LCJFUjRtS0JwRTdNYTJUNTZlIjp7ImRp
c2N1c3Npb25JZCI6ImxCdmd0YkdhQlR2ZlZTWWciLCJzdWIiOi
JnaDo2ODI1MDM1MCIsInRleHQiOiJJT1RBIiwiY3JlYXRlZCI6
MTU5NTg4MDA3NDI1M30sIkxaNHJrWkZUYzd4Zkk2OVIiOnsiZG
lzY3Vzc2lvbklkIjoiVXNQbFpFMVhBdXMwN1NMMCIsInN1YiI6
ImdoOjY4MjUwMzUwIiwidGV4dCI6IklzIGl0IG9rIHRvIHVzZS
B0aGUgbWF0aGVtYXRpY2FsIHRlcm1pbm9sb2d5IGhlcmU/Iiwi
Y3JlYXRlZCI6MTU5NTg4MDc0MDUwMX0sInB1eUhEY2YyVWZWbm
Ryb0IiOnsiZGlzY3Vzc2lvbklkIjoiUEpCeHdKZmFNQzBjMEs2
aSIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4dCI6IldlIG5lZW
QgdG8gZGVmaW5lIGF0dGFja3Mgc29tZXdoZXJlLiBBbHNvLCBk
b2VzIGl0IG1ha2Ugc2Vuc2UgdG8gaGF2ZSBhIGJsb3diYWxsIG
F0dGFjayB3aXRoIG5vIG1pbGVzdG9uZXM/IiwiY3JlYXRlZCI6
MTU5NTg4MDgwMzM4OH0sIk95RFB5c3JNSmNjMGVuVm4iOnsiZG
lzY3Vzc2lvbklkIjoiaVNhTUxtc002ZU1LQ2p4SiIsInN1YiI6
ImdoOjY4MjUwMzUwIiwidGV4dCI6IkkgYmVsaWV2ZSB3ZSBjYW
4gYmUgcHJlY2lzZSBoZXJlIHdpdGggc29tZSBtYXRoIGZyb20g
VFMuLi4iLCJjcmVhdGVkIjoxNTk1ODgwODY4MDQ5fSwidExxRE
5vY050SjJXT0pGRiI6eyJkaXNjdXNzaW9uSWQiOiJnVkVKQjV1
SklwY0V4TTNzIiwic3ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0Ij
oiUGVoYXBzIGEgc2VjdGlvbiBkZXNjcmliaW5nIHBvc3NpYmxl
IGF0dGFja3Mgd291bGQgbWlrZSB0aGUgZmlsZSBjbGVhbmVyIi
wiY3JlYXRlZCI6MTU5NTg4MTExMTU2N30sIlJNaTBNclFSSlRw
RVJBZzQiOnsiZGlzY3Vzc2lvbklkIjoiR05iRDdKaFV0eDloY1
hxUyIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4dCI6IldlIG5l
ZWQgdG8gZGVmaW5lIHRoZSB0ZXJtIFwib3JwaGFuYWdlXCIgYm
Vmb3JlIHVzaW5nIGl0IiwiY3JlYXRlZCI6MTU5NTg4MTM4NTUy
NH0sIm5nbWlSSE9QbExZUTA2VWwiOnsiZGlzY3Vzc2lvbklkIj
oibnFGN2NsY1g4UHZyOW5sVSIsInN1YiI6ImdoOjY4MjUwMzUw
IiwidGV4dCI6IkZvbGxvd2luZyBTZWJhc3RpYW5zIENvbW1lbn
RzIEkgd291bGQgc3VnZ2VzdCB0aGlzIHNlY3Rpb24gdG8gY29t
ZSBiZWZvcmUsIHNpbmNlIHdlIG1hbnkgdGltZXMgdGFsayBhYm
91dCBvcnBoYW5hZ2UgYW5kIGZpbmFsaXR5IGJlZm9yZS4iLCJj
cmVhdGVkIjoxNTk1ODgyMjM4MjcwfSwiNGNNMkU4QWdBbGwwMz
Q3YiI6eyJkaXNjdXNzaW9uSWQiOiJHRnpjdERRUnlGZnp5OXZ4
Iiwic3ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiVGhpcyBzaG
91bGQgaW5kdWNlIGEgbmV3IHBhcmFtZXRlciIsImNyZWF0ZWQi
OjE1OTU4OTcyNDgzMDZ9LCJQNjVvRXNBRFdvZ0x2cWtFIjp7Im
Rpc2N1c3Npb25JZCI6IjUyNncxMEI5UXhMN2RHWWYiLCJzdWIi
OiJnaDo2ODI1MDM1MCIsInRleHQiOiJXZSBpbml0aWFsbHkgaW
50cm9kdWNlZCA0IGdyYWRlcywgc28gd2UgY291bGQgaGF2ZSBv
bmUga2luZCBvZiBmaW5hbGl0eSBpbiBzb21lIHNlY29uZHMgKH
RoZSBzbWFsbCBuZXR3b3JrIGRlbGF5IHdpdGggbm8gY29uZmxp
Y3RzKSwgSSBmZWVsIGxpa2UgY2hhbmdpbmcgaXQgaXMgYmFkIG
ZvciBQUi4iLCJjcmVhdGVkIjoxNTk1ODk3OTgzODMwfSwiWGtt
dUpnS2pISGdkazYyRyI6eyJkaXNjdXNzaW9uSWQiOiJNcncxSU
ducFpCQ2JKRExqIiwic3ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0
IjoiOiIsImNyZWF0ZWQiOjE1OTU4OTgwNDA1MzZ9LCIzSHhFc2
R1UXMxVXFMblpCIjp7ImRpc2N1c3Npb25JZCI6InVjcVNxakZM
WFB2c3VWR1QiLCJzdWIiOiJnaDo2ODI1MDM1MCIsInRleHQiOi
JTaG91bGRuJ3QgdGhpcyBiZSBpbiBwc2V1ZG8tQWxnb3JpdGht
PyIsImNyZWF0ZWQiOjE1OTU4OTg4MDkxNzF9LCJxRlJzcmhtOU
ZJSmF0dk5UIjp7ImRpc2N1c3Npb25JZCI6ImxVOXY3RncydFdI
S0tuT2MiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJJbi
BwYXJ0aWN1bGFyLCB0aGlzIGVuZm9yY2VzIG1vbm90b25pY2l0
eSBvZiB0aW1lc3RhbXBzLCBcIj4wXCIsIFRoaXMgaXMgc29tZW
hvdyBoaWRkZW4gaGVyZSBhbmQgc2hvdWxkIGJlIG1vdmVkIHRv
IFRpbWVzdGFtcENoZWNrIiwiY3JlYXRlZCI6MTU5NTkxNTI4MD
A0OX0sIk5tblowMW1iT0I4R3RYS2IiOnsiZGlzY3Vzc2lvbklk
Ijoia2tFb2dWaHhwT2taVnJXRSIsInN1YiI6ImdoOjUwNjYxOD
Q0IiwidGV4dCI6IkJhc2ljYWxseS4gIEEgbm9kZSBpcyB0aHJv
d24gb3V0IG9mIHN5bmMuIiwiY3JlYXRlZCI6MTU5NTkyNTA2MT
Q2OH0sIk1OV2g1bzJ4QWxXa25ORTAiOnsiZGlzY3Vzc2lvbklk
IjoibFdNRGFpNFdsQzlHdnBlcSIsInN1YiI6ImdoOjUwNjYxOD
Q0IiwidGV4dCI6IkltIG5vdCBzdXJlIGhvdyB0byBkZWZpbmUg
aXQgaW4gY29uY2lzZSB3YXkuIiwiY3JlYXRlZCI6MTU5NTkyNT
ExMDY2OH0sIlFITHoxVEVDa0NFc3pTQTkiOnsiZGlzY3Vzc2lv
bklkIjoiTVJNamVyamh5NGJZR0VrbyIsInN1YiI6ImdoOjUwNj
YxODQ0IiwidGV4dCI6IlRoZSBlbGlnaWJpbGl0eSBzdGF0dXMg
aXMgcGVuZGluZyIsImNyZWF0ZWQiOjE1OTU5MjUyMDk2NDJ9LC
JIdXQ0a09Xb043MlZwVTY3Ijp7ImRpc2N1c3Npb25JZCI6IlhI
V3RtcTluMGxjVVBIeW4iLCJzdWIiOiJnaDo1MDY2MTg0NCIsIn
RleHQiOiJUaGlzIGhhcyB0byBiZSBkZWZpbmVkIGluIGFub3Ro
ZXIgc3BlY2lmaWNhdGlvbjogdGhlIGhhc2ggb2YgZWFjaCBtZX
NzYWdlIGlzIHRoZSBNZXNzYWdlSUQiLCJjcmVhdGVkIjoxNTk1
OTI1MjU2MjQ2fSwiM3lqTjBVbUx6dzVTbUlHMiI6eyJkaXNjdX
NzaW9uSWQiOiJoTkNLVERkZTM4YXU1WXV1Iiwic3ViIjoiZ2g6
NTA2NjE4NDQiLCJ0ZXh0IjoiSSB0aGluayBpdCB3aWxsIGJlIF
VOSVggdGltZSIsImNyZWF0ZWQiOjE1OTU5MjUyODczMDZ9LCI3
aDlMeFVCRUdudHdRVk8yIjp7ImRpc2N1c3Npb25JZCI6IllaT2
c3emMxcmJPR2ZsZFoiLCJzdWIiOiJnaDo1MDY2MTg0NCIsInRl
eHQiOiJUaGF0IGlzIGJleW9uZCB0aGUgc2NvcGUgb2YgdGhpcy
Bkb2N1bWVudCIsImNyZWF0ZWQiOjE1OTU5MjUzMzg4MTh9LCJ6
VFNpSGYxM0hsVmloRWk0Ijp7ImRpc2N1c3Npb25JZCI6IjhabU
NFc2loelhKRk05MTIiLCJzdWIiOiJnaDo1MDY2MTg0NCIsInRl
eHQiOiJJIGRvbnQgdW5kZXJzdGFuZD8iLCJjcmVhdGVkIjoxNT
k1OTI1NDM5ODc4fSwibzRPeVA1MTNFbkI5d2h2ayI6eyJkaXNj
dXNzaW9uSWQiOiJmUmdzRlpuclRjZmUyNGIzIiwic3ViIjoiZ2
g6NTA2NjE4NDQiLCJ0ZXh0IjoiVGhhdCBpcyB0cmVhdGVkIGlu
IHRoZSBkYXRhIHByb2Nlc3Npbmcgc3BlYyIsImNyZWF0ZWQiOj
E1OTU5MjU1MDAxNzh9LCJGSTRLbU5pQ2gyV0xINTcwIjp7ImRp
c2N1c3Npb25JZCI6Iko2aXJIckV1VWxSaU1SMGUiLCJzdWIiOi
JnaDo1MDY2MTg0NCIsInRleHQiOiJUaGlzIDEsMiwzIGlzIGxp
c3RlZCBpbnQgaGUgZGF0YSBwcm9jZXNzaW5nIHNwZWMsIHNpbm
NlIHRoZXNlIGNvbXBvbmVudHMgYXJlIGludGVydHdpbmVkIHdp
dGggdGhlIG90aGVyIHBhcnRzIG9mIHRoZSBwcm90b2NvbC4iLC
JjcmVhdGVkIjoxNTk1OTI1NTYyODEwfSwiVGloeW5XMEtPTjU4
cHRQUiI6eyJkaXNjdXNzaW9uSWQiOiJsVTl2N0Z3MnRXSEtLbk
9jIiwic3ViIjoiZ2g6NTA2NjE4NDQiLCJ0ZXh0IjoiVGhpcyBp
cyBhIGJlbG93IG1heCBkZXB0aCBpc3N1ZS4gIFRocmVlIGlzIG
EgaGFyZCBjcml0ZXJpb24gdGltZXN0YW1wIGNyaXRlcmlvbiB0
aGV5IG5lZWQgdG8gc2F0aXNmeS4iLCJjcmVhdGVkIjoxNTk1OT
I1NjM5MDc4fSwiRVBnVHlRMGpMM3FOQWJUNiI6eyJkaXNjdXNz
aW9uSWQiOiJDTnNYQnZBM0R6OElnNlhpIiwic3ViIjoiZ2g6NT
A2NjE4NDQiLCJ0ZXh0IjoiVGhlIHRhbmdsZSBkaWVzLiAgSSBk
b250IHRoaW5rIHRoaXMgaXMgbGlrZWx5LiIsImNyZWF0ZWQiOj
E1OTU5MjU3MjM2NjZ9LCJxWE54S1Z3Q3R0cnViS0NvIjp7ImRp
c2N1c3Npb25JZCI6IkdGemN0RFFSeUZmenk5dngiLCJzdWIiOi
JnaDo1MDY2MTg0NCIsInRleHQiOiJJIHRoaW5rIHRoaXMgYmVo
YXZpb3IgaXMgbGVmdCB0byB0aGUgZGlzY3JldGlvbiBvZiB0aG
Ugbm9kZSBpbXBsZW1lbnRhdGlvbiIsImNyZWF0ZWQiOjE1OTU5
MjU4MTcyOTJ9LCJvOEprTG5SUTNEWDVvYW0wIjp7ImRpc2N1c3
Npb25JZCI6ImpTd2ZPY21aM0J1YWpyb1MiLCJzdWIiOiJnaDo1
MDY2MTg0NCIsInRleHQiOiJXZSBrZWVwIG9uIHNlbGVjdGluZy
B1bnRpbGwgd2UgZ2V0IGEgdGlwIHdlIGNhbiBhcHByb3ZlLiIs
ImNyZWF0ZWQiOjE1OTU5MjU5Mzc1NjB9LCJmQ0FKQ25nMjdscG
tLOU9QIjp7ImRpc2N1c3Npb25JZCI6IlVzUGxaRTFYQXVzMDdT
TDAiLCJzdWIiOiJnaDo1MDY2MTg0NCIsInRleHQiOiJJIGhhdm
Ugbm8gaWRlYSEiLCJjcmVhdGVkIjoxNTk1OTI1OTU0NzUwfSwi
bGI3VWJTN2FWNWJPWVc3ZyI6eyJkaXNjdXNzaW9uSWQiOiJHTm
JEN0poVXR4OWhjWHFTIiwic3ViIjoiZ2g6NTA2NjE4NDQiLCJ0
ZXh0IjoiSSB0aG91Z2h0IGl0IHdhcyBvbmUgb2Ygb3VyIHN0YW
5kYXJkIHdvcmRzPyIsImNyZWF0ZWQiOjE1OTU5MjYzNTkyMzN9
LCJvYWFWVlFQNkw0aENtbVI2Ijp7ImRpc2N1c3Npb25JZCI6Ik
RPb2w3SklYT09iTEV0WEYiLCJzdWIiOiJnaDo1MDY2MTg0NCIs
InRleHQiOiJJIGFncmVlLiAgQnV0IHdlIGhhdmVudCBkb25lIG
l0IHlldC4iLCJjcmVhdGVkIjoxNTk1OTI2MzgzODk0fSwic25L
NGJocXlUSW4xRTc0TiI6eyJkaXNjdXNzaW9uSWQiOiJucUY3Y2
xjWDhQdnI5bmxVIiwic3ViIjoiZ2g6NTA2NjE4NDQiLCJ0ZXh0
IjoiSXRzIHRyaWNreSBiZWNhdXNlIGhvdyBjYW4geW91IHJlYW
xseSBtYWtlIHNlbnNlIG9mIGZpbmFsaXR5IGJlZm9yZSBjb3Zl
cmluZyB0aXAgc2VsZWN0aW9uIGFuZCBlbGlnaWJpbGl0eS4gIF
RoZSByYXRpb25hbGVzIGFyZW50IHZlcnkgbGluZWFyLiIsImNy
ZWF0ZWQiOjE1OTU5MjY0NjU0NDV9fSwiaGlzdG9yeSI6WzIyND
YxMzU2OSwtMTU2NjM5MTc0NiwtMTEwMjMzNDc5NF19
-->