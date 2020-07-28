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
OjQ3NzIsImVuZCI6NDgyNH0sImpTd2ZPY21aM0J1YWpyb1MiOn
sidGV4dCI6ImN1cnJlbnRUaW1lLW1lc3NhZ2VJZC50aW1lU3Rh
bXA8RGVsdGEiLCJzdGFydCI6NzAyNywiZW5kIjo3MDY0fSwibW
VDRUlwWjV4TE1LdWNnTSI6eyJ0ZXh0IjoiY29uZmlybWF0aW9u
IGNvbmZpZGVuY2UiLCJzdGFydCI6ODYyNSwiZW5kIjo4NjQ4fS
wiRE9vbDdKSVhPT2JMRXRYRiI6eyJ0ZXh0IjoiV2Uga25vdyBm
b3IgaW5zdGFuY2UgdGhlIHByb2JhYmlsaXR5IG9mIGJlaW5nIG
9ycGhhbmVkIGlzIFwic21hbGxcIiwgYnV0IHdlIGRvIG5v4oCm
Iiwic3RhcnQiOjExMjQ1LCJlbmQiOjExMzc1fSwiS1VVUFduSD
MxMFlQUDZuRCI6eyJ0ZXh0IjoiY29uZmlybWF0aW9uQ29uZmlk
ZW5jIiwic3RhcnQiOjEyNzEyLCJlbmQiOjEyNzMzfSwiZzJNRn
g5Y0Jab2hTRXdRZSI6eyJ0ZXh0IjoiUmVjYWxsIHQiLCJzdGFy
dCI6MTMwODEsImVuZCI6MTMwODl9LCJlY1JUMHVnNE9MVXVaem
NjIjp7InRleHQiOiJoZSBmb2xsb3dpbmciLCJzdGFydCI6MTUx
ODYsImVuZCI6MTUxOTh9LCJDTnNYQnZBM0R6OElnNlhpIjp7In
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
QiOjc3Njl9LCJ3Tkd3dDh0M2p4eDRrWlczIjp7InRleHQiOiJ3
aXRob3V0IHRyYXZlcnNpbmcgdGhlIHRhbmdsZSBtYXJraW5nIG
ZsYWdzLiIsInN0YXJ0Ijo4MDIxLCJlbmQiOjgwNjV9LCJnVkVK
QjV1SklwY0V4TTNzIjp7InRleHQiOiJmb2xsb3dpbmcgYXR0YW
NrIiwic3RhcnQiOjgzNDEsImVuZCI6ODM1N30sIkdOYkQ3SmhV
dHg5aGNYcVMiOnsidGV4dCI6Im9ycGhhbmVkIiwic3RhcnQiOj
kzMDIsImVuZCI6OTMxMH0sIm5xRjdjbGNYOFB2cjlubFUiOnsi
dGV4dCI6IkZpbmFsaXR5Iiwic3RhcnQiOjExMzg3LCJlbmQiOj
ExMzk1fSwiR0Z6Y3REUVJ5RmZ6eTl2eCI6eyJ0ZXh0IjoiUGVy
aW9kaWNhbGx5Iiwic3RhcnQiOjYyNTQsImVuZCI6NjI2Nn0sIj
UyNncxMEI5UXhMN2RHWWYiOnsidGV4dCI6IkdyYWRlIDEiLCJz
dGFydCI6MTIyMzYsImVuZCI6MTIyNDN9LCJNcncxSUducFpCQ2
JKRExqIjp7InRleHQiOiIuIiwic3RhcnQiOjE0MDY5LCJlbmQi
OjE0MDcwfSwidWNxU3FqRkxYUHZzdVZHVCI6eyJ0ZXh0IjoiUm
Vtb3ZlIG1lc3NhZ2VJRCBmcm9tIGBwZW5kaW5nYCBpZiBwcmVz
ZW50XG4qIFJlbW92ZSBtZXNzYWdlSUQgZnJvbSBgZWxpZ2libG
VUaXDigKYiLCJzdGFydCI6MTUyMDIsImVuZCI6MTUzMzl9LCJs
VTl2N0Z3MnRXSEtLbk9jIjp7InRleHQiOiJEZWx0YT5tZXNzYW
dlSUQudGltZXN0YW1wLW1lc3NhZ2VJRC5wYXJlbnQxLnRpbWVT
dGFtcCA+MCIsInN0YXJ0Ijo0ODc0LCJlbmQiOjQ5MzB9fSwiY2
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
MTU5NTU3MzQ3OTEwOH0sIkJZTlB1dURaVUxKVVI2QWUiOnsiZG
lzY3Vzc2lvbklkIjoiaE5DS1REZGUzOGF1NVl1dSIsInN1YiI6
ImdoOjUxMTEyNjE4IiwidGV4dCI6IlN0cmljdGx5IHNwZWFraW
5nIHRoaXMgaXMgbm90IGEgdGltZSwgbW9yZSBhIHBvaW50IGlu
IHRpbWUgKHdlIGJlbGlldmUgdG8gbGl2ZSBpbikuIFVOSVgtdG
ltZT8iLCJjcmVhdGVkIjoxNTk1NTc0NTMyODczfSwiWlB2dW9G
TGdWclVtWDJiRyI6eyJkaXNjdXNzaW9uSWQiOiJZWk9nN3pjMX
JiT0dmbGRaIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ijoi
d2hlcmUgd2lsbCB0aGV5IGJlIHN0b3JlZD8iLCJjcmVhdGVkIj
oxNTk1NTc0NjM2NTc5fSwiS2k2bWRpb1BTR2lPS2pzVyI6eyJk
aXNjdXNzaW9uSWQiOiI4Wm1DRXNpaHpYSkZNOTEyIiwic3ViIj
oiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoibWFrZSBjb25zaXN0ZW50
OyBzdGFydCB1cHBlciBvciBsb3dlciBjYXNlIGFmdGVyICcgJy
wgb3IgdXNlIDogPyIsImNyZWF0ZWQiOjE1OTU1NzQ3NjcwNTl9
LCJxM09ROUJvZ280OGhVNFRwIjp7ImRpc2N1c3Npb25JZCI6Ij
habUNFc2loelhKRk05MTIiLCJzdWIiOiJnaDo1MTExMjYxOCIs
InRleHQiOiJ1c2UgdGhlIHNhbWUgdGhyb3VnaG91dCB0aGUgc3
BlY3MiLCJjcmVhdGVkIjoxNTk1NTc0ODEyNzE2fSwidllqMzRV
ekhGdE91a0hzSCI6eyJkaXNjdXNzaW9uSWQiOiJPcVlkcllzeW
FyYkhvWUVnIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ijoi
Y3VycmVudCBsb2NhbCB0aW1lPyIsImNyZWF0ZWQiOjE1OTU1Nz
UwMDkyNjV9LCJhYVI1M1JiWmpyYU5RaGpvIjp7ImRpc2N1c3Np
b25JZCI6Ik9xWWRyWXN5YXJiSG9ZRWciLCJzdWIiOiJnaDo1MT
ExMjYxOCIsInRleHQiOiJpZiBpdCByZWZlcnMgdG8gdGhlIHZh
cmlhYmxlIGBjdXJyZW50IHRpbWVgYWRkIHRoZXNlIGBzIiwiY3
JlYXRlZCI6MTU5NTU3NTA4NjM5OX0sInZLR0FFYzdFZDNETDND
NXMiOnsiZGlzY3Vzc2lvbklkIjoiTFJzdUxwS2NvMjBUbFRlMy
IsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IkJUVyB3aGVy
ZSBpcyBpdCBzcGVjaWZpZWQgaG93IHRvIGNob29zZSB3IGFuZC
B0aGUgb3RoZXIgcGFyYW1ldGVycz8iLCJjcmVhdGVkIjoxNTk1
NTc1MTQzNDM3fSwiVHAzUHhZVW1OOERwdXZlayI6eyJkaXNjdX
NzaW9uSWQiOiJmUmdzRlpuclRjZmUyNGIzIiwic3ViIjoiZ2g6
NTExMTI2MTgiLCJ0ZXh0IjoiSXMgdGhpcyBhZnRlciB0aGUgbW
Vzc2FnZSBwYXNzZWQgdGhlIHJhdGUgbWFuYWdlcj8gSWYgeWVz
LCBJIG0gYSBiaXQgY29uZnVzZWQsIG5vZGUgd2l0aCBkaWZmZX
JlbnQgbWFuYSBwZXJjZXB0aW9uIG1pZ2h0IGhhbmRsZSB0aGUg
bWVzc2FnZSBkaWZmZXJlbnRseSIsImNyZWF0ZWQiOjE1OTU1Nz
U1NjMxNzB9LCJWNGRLYmZ3UTdQWEJGSWM2Ijp7ImRpc2N1c3Np
b25JZCI6Iko2aXJIckV1VWxSaU1SMGUiLCJzdWIiOiJnaDo1MT
ExMjYxOCIsInRleHQiOiJEb2VzIHRoaXMgY29tZSBiZWZvcmUg
dGhlIGFib3ZlIHN0ZXAgb3IgYWZ0ZXI/IEEgZ3JhcGggbGlrZS
BpbiAxLTMgc2hvd2luZyB0aGUgcHJvY2Vzc2VzIG1pZ2h0IGJl
IGdvb2QiLCJjcmVhdGVkIjoxNTk1NTc2MTI1NzMxfSwiTFB2VX
REUTVPZWxrOHlDNSI6eyJkaXNjdXNzaW9uSWQiOiJKNmlySHJF
dVVsUmlNUjBlIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ij
oiT3IgaXMgdGhpcyBjb250YWluZWQgaW4gdGhlIHRpbWVzdGFt
cCBjaGVjayBpbiAxLTM/IiwiY3JlYXRlZCI6MTU5NTU3NjI5Nj
I1Nn0sImszWERYVVJoMXl0NWk3d1ciOnsiZGlzY3Vzc2lvbklk
IjoialN3Zk9jbVozQnVhanJvUyIsInN1YiI6ImdoOjUxMTEyNj
E4IiwidGV4dCI6ImRvbiB0IHVuZGVyc3RhbmQ/IElzIHRoaXMg
Z2V0VGlwIGZvciBuZXcgbWVzc2FnZS5JRD8iLCJjcmVhdGVkIj
oxNTk1NTc2OTIzNjI4fSwiNVh2c1NMejBxbkd0ZmFxYiI6eyJk
aXNjdXNzaW9uSWQiOiJtZUNFSXBaNXhMTUt1Y2dNIiwic3ViIj
oiZ2g6NTExMTI2MTgiLCJ0ZXh0Ijoid2hlcmUgaXMgdGhpcyBk
ZWZpbmVkPyIsImNyZWF0ZWQiOjE1OTU1NzcxODEyNTl9LCJ3ZX
RPNkZBT2FkYlk0WmVlIjp7ImRpc2N1c3Npb25JZCI6IkRPb2w3
SklYT09iTEV0WEYiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleH
QiOiJUaGlzIHNob3VsZCBiZSBjYWxjdWxhYmxlLiBVbmRlciBz
b21lIGFzc3VtcHRpb25zIG9mIG1hbGljaW91cyBtcHMgYW5kIG
hvbmVzdCBtcHMgZXZlbiB0aGVvcmV0aWNhbGx5LiIsImNyZWF0
ZWQiOjE1OTU1Nzc2MzE3NTZ9LCJsandvU3M3QU9aVTRlRzNxIj
p7ImRpc2N1c3Npb25JZCI6IktVVVBXbkgzMTBZUFA2bkQiLCJz
dWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJJcyB0aGlzIHRoZS
BkZWZpbml0aW9uIG9mIGNvbmZpZGVuY2UgbGV2ZWw/IiwiY3Jl
YXRlZCI6MTU5NTU3Nzk2NTMzMX0sImVLQ0lFb1N3MjhxcFVLWE
4iOnsiZGlzY3Vzc2lvbklkIjoiZzJNRng5Y0Jab2hTRXdRZSIs
InN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IndoZXJlIGlzIH
RoaXMgZGVmaW5lZD8iLCJjcmVhdGVkIjoxNTk1NTc4MDI4NzAx
fSwiRFRxZGhBMThoMXdwUndudSI6eyJkaXNjdXNzaW9uSWQiOi
JlY1JUMHVnNE9MVXVaemNjIiwic3ViIjoiZ2g6NTExMTI2MTgi
LCJ0ZXh0IjoiaXMgdGhlcmUgYSBjaGFuY2UgdGhhdCBhIG1lc3
NhZ2UgZ2V0cyB0cmFwcGVkIGluIHRoZSBNZXNzYWdlIEluYm94
IGFuZCBoYXMgdG8gYmUgcmVtb3ZlZCB0b28/IiwiY3JlYXRlZC
I6MTU5NTU3ODQ4ODU1MX0sImJlbzk0d3VjV1ppTEdhSloiOnsi
ZGlzY3Vzc2lvbklkIjoiQ05zWEJ2QTNEejhJZzZYaSIsInN1Yi
I6ImdoOjUxMTEyNjE4IiwidGV4dCI6IldoYXQgaGFwcGVucyBp
ZiBlbGlnaWJsZVRpcHNMaXN0IGlzIGVtcHR5IGZvciBhbGwgbm
9kZXM/IFNob3VsZCBudCB3ZSB0aGluayBhYm91dCBoYW5kbGlu
ZyB0aGlzIGNhc2U/IiwiY3JlYXRlZCI6MTU5NTU3ODYzMTEzNn
0sInJHVHIxVkYwbUZRY2pkMjgiOnsiZGlzY3Vzc2lvbklkIjoi
TFJzdUxwS2NvMjBUbFRlMyIsInN1YiI6ImdoOjY4MjUwMzUwIi
widGV4dCI6IlVzdWFsbHkgU2VyZ3VlaSBzYXlzIFwiUHV0IGFu
eSByZWFzb25hYmxlIGluaXRpYWwgcGFyYW1ldGVyIGFuZCB3ZS
BjaGFuZ2UgYWZ0ZXIgdGVzdGluZ1wiLiIsImNyZWF0ZWQiOjE1
OTU4NzkzNzc3MDB9LCJlN0pZWkRpUHBrM0d4akFlIjp7ImRpc2
N1c3Npb25JZCI6Iko2aXJIckV1VWxSaU1SMGUiLCJzdWIiOiJn
aDo2ODI1MDM1MCIsInRleHQiOiJGcm9tIHRoZSBsYXN0IGRpc2
N1c3Npb24gZnJvbSB0aGUgZ3JvdXAsIEJNRCBjaGVjayBpcyBw
YXJ0IG9mIHNvbGlkaWZpY2F0aW9uLCBwZWhhcHMgd2UgbmVlZC
B0byBjaGFuZ2Ugc2Vzc2lvbnMgdG8gcmVmbGVjdCB0aGlzPyBJ
IHdpbGwgZGlzY3VzcyB0aGlzIGluIHRoZSBwcm90b2NvbCBjYW
xsIHRvbW9ycm93ISIsImNyZWF0ZWQiOjE1OTU4Nzk3MDIzNzJ9
LCJFUjRtS0JwRTdNYTJUNTZlIjp7ImRpc2N1c3Npb25JZCI6Im
xCdmd0YkdhQlR2ZlZTWWciLCJzdWIiOiJnaDo2ODI1MDM1MCIs
InRleHQiOiJJT1RBIiwiY3JlYXRlZCI6MTU5NTg4MDA3NDI1M3
0sIkxaNHJrWkZUYzd4Zkk2OVIiOnsiZGlzY3Vzc2lvbklkIjoi
VXNQbFpFMVhBdXMwN1NMMCIsInN1YiI6ImdoOjY4MjUwMzUwIi
widGV4dCI6IklzIGl0IG9rIHRvIHVzZSB0aGUgbWF0aGVtYXRp
Y2FsIHRlcm1pbm9sb2d5IGhlcmU/IiwiY3JlYXRlZCI6MTU5NT
g4MDc0MDUwMX0sInB1eUhEY2YyVWZWbmRyb0IiOnsiZGlzY3Vz
c2lvbklkIjoiUEpCeHdKZmFNQzBjMEs2aSIsInN1YiI6ImdoOj
Y4MjUwMzUwIiwidGV4dCI6IldlIG5lZWQgdG8gZGVmaW5lIGF0
dGFja3Mgc29tZXdoZXJlLiBBbHNvLCBkb2VzIGl0IG1ha2Ugc2
Vuc2UgdG8gaGF2ZSBhIGJsb3diYWxsIGF0dGFjayB3aXRoIG5v
IG1pbGVzdG9uZXM/IiwiY3JlYXRlZCI6MTU5NTg4MDgwMzM4OH
0sIk95RFB5c3JNSmNjMGVuVm4iOnsiZGlzY3Vzc2lvbklkIjoi
aVNhTUxtc002ZU1LQ2p4SiIsInN1YiI6ImdoOjY4MjUwMzUwIi
widGV4dCI6IkkgYmVsaWV2ZSB3ZSBjYW4gYmUgcHJlY2lzZSBo
ZXJlIHdpdGggc29tZSBtYXRoIGZyb20gVFMuLi4iLCJjcmVhdG
VkIjoxNTk1ODgwODY4MDQ5fSwidTZTcE9HZFlBOWp2Z25yRCI6
eyJkaXNjdXNzaW9uSWQiOiJ3Tkd3dDh0M2p4eDRrWlczIiwic3
ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiSXNuJ3QgY2hlY2tp
bmcgcGFzdCBjb25lIGp1c3QgYXMgZXhwZW5zaXZlPyIsImNyZW
F0ZWQiOjE1OTU4ODA5MTM4MTF9LCJ0THFETm9jTnRKMldPSkZG
Ijp7ImRpc2N1c3Npb25JZCI6ImdWRUpCNXVKSXBjRXhNM3MiLC
JzdWIiOiJnaDo2ODI1MDM1MCIsInRleHQiOiJQZWhhcHMgYSBz
ZWN0aW9uIGRlc2NyaWJpbmcgcG9zc2libGUgYXR0YWNrcyB3b3
VsZCBtaWtlIHRoZSBmaWxlIGNsZWFuZXIiLCJjcmVhdGVkIjox
NTk1ODgxMTExNTY3fSwiUk1pME1yUVJKVHBFUkFnNCI6eyJkaX
NjdXNzaW9uSWQiOiJHTmJEN0poVXR4OWhjWHFTIiwic3ViIjoi
Z2g6NjgyNTAzNTAiLCJ0ZXh0IjoiV2UgbmVlZCB0byBkZWZpbm
UgdGhlIHRlcm0gXCJvcnBoYW5hZ2VcIiBiZWZvcmUgdXNpbmcg
aXQiLCJjcmVhdGVkIjoxNTk1ODgxMzg1NTI0fSwibmdtaVJIT1
BsTFlRMDZVbCI6eyJkaXNjdXNzaW9uSWQiOiJucUY3Y2xjWDhQ
dnI5bmxVIiwic3ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiRm
9sbG93aW5nIFNlYmFzdGlhbnMgQ29tbWVudHMgSSB3b3VsZCBz
dWdnZXN0IHRoaXMgc2VjdGlvbiB0byBjb21lIGJlZm9yZSwgc2
luY2Ugd2UgbWFueSB0aW1lcyB0YWxrIGFib3V0IG9ycGhhbmFn
ZSBhbmQgZmluYWxpdHkgYmVmb3JlLiIsImNyZWF0ZWQiOjE1OT
U4ODIyMzgyNzB9LCI0Y00yRThBZ0FsbDAzNDdiIjp7ImRpc2N1
c3Npb25JZCI6IkdGemN0RFFSeUZmenk5dngiLCJzdWIiOiJnaD
o2ODI1MDM1MCIsInRleHQiOiJUaGlzIHNob3VsZCBpbmR1Y2Ug
YSBuZXcgcGFyYW1ldGVyIiwiY3JlYXRlZCI6MTU5NTg5NzI0OD
MwNn0sIlA2NW9Fc0FEV29nTHZxa0UiOnsiZGlzY3Vzc2lvbklk
IjoiNTI2dzEwQjlReEw3ZEdZZiIsInN1YiI6ImdoOjY4MjUwMz
UwIiwidGV4dCI6IldlIGluaXRpYWxseSBpbnRyb2R1Y2VkIDQg
Z3JhZGVzLCBzbyB3ZSBjb3VsZCBoYXZlIG9uZSBraW5kIG9mIG
ZpbmFsaXR5IGluIHNvbWUgc2Vjb25kcyAodGhlIHNtYWxsIG5l
dHdvcmsgZGVsYXkgd2l0aCBubyBjb25mbGljdHMpLCBJIGZlZW
wgbGlrZSBjaGFuZ2luZyBpdCBpcyBiYWQgZm9yIFBSLiIsImNy
ZWF0ZWQiOjE1OTU4OTc5ODM4MzB9LCJYa211SmdLakhIZ2RrNj
JHIjp7ImRpc2N1c3Npb25JZCI6Ik1ydzFJR25wWkJDYkpETGoi
LCJzdWIiOiJnaDo2ODI1MDM1MCIsInRleHQiOiI6IiwiY3JlYX
RlZCI6MTU5NTg5ODA0MDUzNn0sIjNIeEVzZHVRczFVcUxuWkIi
OnsiZGlzY3Vzc2lvbklkIjoidWNxU3FqRkxYUHZzdVZHVCIsIn
N1YiI6ImdoOjY4MjUwMzUwIiwidGV4dCI6IlNob3VsZG4ndCB0
aGlzIGJlIGluIHBzZXVkby1BbGdvcml0aG0/IiwiY3JlYXRlZC
I6MTU5NTg5ODgwOTE3MX0sInFGUnNyaG05RklKYXR2TlQiOnsi
ZGlzY3Vzc2lvbklkIjoibFU5djdGdzJ0V0hLS25PYyIsInN1Yi
I6ImdoOjUxMTEyNjE4IiwidGV4dCI6IkluIHBhcnRpY3VsYXIs
IHRoaXMgZW5mb3JjZXMgbW9ub3RvbmljaXR5IG9mIHRpbWVzdG
FtcHMsIFwiPjBcIiwgVGhpcyBpcyBzb21laG93IGhpZGRlbiBo
ZXJlIGFuZCBzaG91bGQgYmUgbW92ZWQgdG8gVGltZXN0YW1wQ2
hlY2siLCJjcmVhdGVkIjoxNTk1OTE1MjgwMDQ5fSwiTm1uWjAx
bWJPQjhHdFhLYiI6eyJkaXNjdXNzaW9uSWQiOiJra0VvZ1ZoeH
BPa1pWcldFIiwic3ViIjoiZ2g6NTA2NjE4NDQiLCJ0ZXh0Ijoi
QmFzaWNhbGx5LiAgQSBub2RlIGlzIHRocm93biBvdXQgb2Ygc3
luYy4iLCJjcmVhdGVkIjoxNTk1OTI1MDYxNDY4fSwiTU5XaDVv
MnhBbFdrbk5FMCI6eyJkaXNjdXNzaW9uSWQiOiJsV01EYWk0V2
xDOUd2cGVxIiwic3ViIjoiZ2g6NTA2NjE4NDQiLCJ0ZXh0Ijoi
SW0gbm90IHN1cmUgaG93IHRvIGRlZmluZSBpdCBpbiBjb25jaX
NlIHdheS4iLCJjcmVhdGVkIjoxNTk1OTI1MTEwNjY4fSwiUUhM
ejFURUNrQ0VzelNBOSI6eyJkaXNjdXNzaW9uSWQiOiJNUk1qZX
JqaHk0YllHRWtvIiwic3ViIjoiZ2g6NTA2NjE4NDQiLCJ0ZXh0
IjoiVGhlIGVsaWdpYmlsaXR5IHN0YXR1cyBpcyBwZW5kaW5nIi
wiY3JlYXRlZCI6MTU5NTkyNTIwOTY0Mn0sIkh1dDRrT1dvTjcy
VnBVNjciOnsiZGlzY3Vzc2lvbklkIjoiWEhXdG1xOW4wbGNVUE
h5biIsInN1YiI6ImdoOjUwNjYxODQ0IiwidGV4dCI6IlRoaXMg
aGFzIHRvIGJlIGRlZmluZWQgaW4gYW5vdGhlciBzcGVjaWZpY2
F0aW9uOiB0aGUgaGFzaCBvZiBlYWNoIG1lc3NhZ2UgaXMgdGhl
IE1lc3NhZ2VJRCIsImNyZWF0ZWQiOjE1OTU5MjUyNTYyNDZ9LC
IzeWpOMFVtTHp3NVNtSUcyIjp7ImRpc2N1c3Npb25JZCI6ImhO
Q0tURGRlMzhhdTVZdXUiLCJzdWIiOiJnaDo1MDY2MTg0NCIsIn
RleHQiOiJJIHRoaW5rIGl0IHdpbGwgYmUgVU5JWCB0aW1lIiwi
Y3JlYXRlZCI6MTU5NTkyNTI4NzMwNn0sIjdoOUx4VUJFR250d1
FWTzIiOnsiZGlzY3Vzc2lvbklkIjoiWVpPZzd6YzFyYk9HZmxk
WiIsInN1YiI6ImdoOjUwNjYxODQ0IiwidGV4dCI6IlRoYXQgaX
MgYmV5b25kIHRoZSBzY29wZSBvZiB0aGlzIGRvY3VtZW50Iiwi
Y3JlYXRlZCI6MTU5NTkyNTMzODgxOH0sInpUU2lIZjEzSGxWaW
hFaTQiOnsiZGlzY3Vzc2lvbklkIjoiOFptQ0VzaWh6WEpGTTkx
MiIsInN1YiI6ImdoOjUwNjYxODQ0IiwidGV4dCI6IkkgZG9udC
B1bmRlcnN0YW5kPyIsImNyZWF0ZWQiOjE1OTU5MjU0Mzk4Nzh9
LCJvNE95UDUxM0VuQjl3aHZrIjp7ImRpc2N1c3Npb25JZCI6Im
ZSZ3NGWm5yVGNmZTI0YjMiLCJzdWIiOiJnaDo1MDY2MTg0NCIs
InRleHQiOiJUaGF0IGlzIHRyZWF0ZWQgaW4gdGhlIGRhdGEgcH
JvY2Vzc2luZyBzcGVjIiwiY3JlYXRlZCI6MTU5NTkyNTUwMDE3
OH0sIkZJNEttTmlDaDJXTEg1NzAiOnsiZGlzY3Vzc2lvbklkIj
oiSjZpckhyRXVVbFJpTVIwZSIsInN1YiI6ImdoOjUwNjYxODQ0
IiwidGV4dCI6IlRoaXMgMSwyLDMgaXMgbGlzdGVkIGludCBoZS
BkYXRhIHByb2Nlc3Npbmcgc3BlYywgc2luY2UgdGhlc2UgY29t
cG9uZW50cyBhcmUgaW50ZXJ0d2luZWQgd2l0aCB0aGUgb3RoZX
IgcGFydHMgb2YgdGhlIHByb3RvY29sLiIsImNyZWF0ZWQiOjE1
OTU5MjU1NjI4MTB9LCJUaWh5blcwS09ONThwdFBSIjp7ImRpc2
N1c3Npb25JZCI6ImxVOXY3RncydFdIS0tuT2MiLCJzdWIiOiJn
aDo1MDY2MTg0NCIsInRleHQiOiJUaGlzIGlzIGEgYmVsb3cgbW
F4IGRlcHRoIGlzc3VlLiAgVGhyZWUgaXMgYSBoYXJkIGNyaXRl
cmlvbiB0aW1lc3RhbXAgY3JpdGVyaW9uIHRoZXkgbmVlZCB0by
BzYXRpc2Z5LiIsImNyZWF0ZWQiOjE1OTU5MjU2MzkwNzh9LCJF
UGdUeVEwakwzcU5BYlQ2Ijp7ImRpc2N1c3Npb25JZCI6IkNOc1
hCdkEzRHo4SWc2WGkiLCJzdWIiOiJnaDo1MDY2MTg0NCIsInRl
eHQiOiJUaGUgdGFuZ2xlIGRpZXMuICBJIGRvbnQgdGhpbmsgdG
hpcyBpcyBsaWtlbHkuIiwiY3JlYXRlZCI6MTU5NTkyNTcyMzY2
Nn0sInFYTnhLVndDdHRydWJLQ28iOnsiZGlzY3Vzc2lvbklkIj
oiR0Z6Y3REUVJ5RmZ6eTl2eCIsInN1YiI6ImdoOjUwNjYxODQ0
IiwidGV4dCI6IkkgdGhpbmsgdGhpcyBiZWhhdmlvciBpcyBsZW
Z0IHRvIHRoZSBkaXNjcmV0aW9uIG9mIHRoZSBub2RlIGltcGxl
bWVudGF0aW9uIiwiY3JlYXRlZCI6MTU5NTkyNTgxNzI5Mn0sIm
84SmtMblJRM0RYNW9hbTAiOnsiZGlzY3Vzc2lvbklkIjoialN3
Zk9jbVozQnVhanJvUyIsInN1YiI6ImdoOjUwNjYxODQ0IiwidG
V4dCI6IldlIGtlZXAgb24gc2VsZWN0aW5nIHVudGlsbCB3ZSBn
ZXQgYSB0aXAgd2UgY2FuIGFwcHJvdmUuIiwiY3JlYXRlZCI6MT
U5NTkyNTkzNzU2MH0sImZDQUpDbmcyN2xwa0s5T1AiOnsiZGlz
Y3Vzc2lvbklkIjoiVXNQbFpFMVhBdXMwN1NMMCIsInN1YiI6Im
doOjUwNjYxODQ0IiwidGV4dCI6IkkgaGF2ZSBubyBpZGVhISIs
ImNyZWF0ZWQiOjE1OTU5MjU5NTQ3NTB9fSwiaGlzdG9yeSI6Wy
0xNTY2MzkxNzQ2LC0xMTAyMzM0Nzk0XX0=
-->