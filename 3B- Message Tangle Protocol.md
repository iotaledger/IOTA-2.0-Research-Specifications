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
OjQ3NzIsImVuZCI6NDgyNH0sImpTd2ZPY21aM0J1YWpyb1MiOn
sidGV4dCI6ImN1cnJlbnRUaW1lLW1lc3NhZ2VJZC50aW1lU3Rh
bXA8RGVsdGEiLCJzdGFydCI6Njk3OSwiZW5kIjo3MDE2fSwibW
VDRUlwWjV4TE1LdWNnTSI6eyJ0ZXh0IjoiY29uZmlybWF0aW9u
IGNvbmZpZGVuY2UiLCJzdGFydCI6ODU3MywiZW5kIjo4NTk2fS
wiRE9vbDdKSVhPT2JMRXRYRiI6eyJ0ZXh0IjoiV2Uga25vdyBm
b3IgaW5zdGFuY2UgdGhlIHByb2JhYmlsaXR5IG9mIGJlaW5nIG
9ycGhhbmVkIGlzIFwic21hbGxcIiwgYnV0IHdlIGRvIG5v4oCm
Iiwic3RhcnQiOjExMTkzLCJlbmQiOjExMzIzfSwiS1VVUFduSD
MxMFlQUDZuRCI6eyJ0ZXh0IjoiY29uZmlybWF0aW9uQ29uZmlk
ZW5jIiwic3RhcnQiOjEyNjYwLCJlbmQiOjEyNjgxfSwiZzJNRn
g5Y0Jab2hTRXdRZSI6eyJ0ZXh0IjoiUmVjYWxsIHQiLCJzdGFy
dCI6MTMwMjksImVuZCI6MTMwMzd9LCJlY1JUMHVnNE9MVXVaem
NjIjp7InRleHQiOiJoZSBmb2xsb3dpbmciLCJzdGFydCI6MTUx
MzQsImVuZCI6MTUxNDZ9LCJDTnNYQnZBM0R6OElnNlhpIjp7In
RleHQiOiJUaXBzIHNlbGVjdGlvbiIsInN0YXJ0Ijo1NDM0LCJl
bmQiOjU0NDd9LCJSS3E5ZWttdVVrVXdIeGV1Ijp7InRleHQiOi
JNb3Jlb3ZlciwiLCJzdGFydCI6NzMxNywiZW5kIjo3MzI2fSwi
bEJ2Z3RiR2FCVHZmVlNZZyI6eyJ0ZXh0IjoiSW90YSIsInN0YX
J0Ijo3NDMzLCJlbmQiOjc0Mzd9LCJVc1BsWkUxWEF1czA3U0ww
Ijp7InRleHQiOiJ3ZWFrIE5hc2ggZXF1aWxpYnJpdW06Iiwic3
RhcnQiOjcyMjgsImVuZCI6NzI1MH0sIlBKQnh3SmZhTUMwYzBL
NmkiOnsidGV4dCI6ImJsb3cgYmFsbCBhdHRhY2tzIiwic3Rhcn
QiOjczNzksImVuZCI6NzM5Nn0sImlTYU1MbXNNNmVNS0NqeEoi
OnsidGV4dCI6IldpdGggYSBsYXJnZSBgRGVsdGFgLCBob25lc3
QgbWVzc2FnZXMgd2lsbCBlc3NlbnRpYWxseSBuZXZlciBiZSBv
cnBoYW5lZC4iLCJzdGFydCI6NzY0NCwiZW5kIjo3NzE3fSwid0
5Hd3Q4dDNqeHg0a1pXMyI6eyJ0ZXh0Ijoid2l0aG91dCB0cmF2
ZXJzaW5nIHRoZSB0YW5nbGUgbWFya2luZyBmbGFncy4iLCJzdG
FydCI6Nzk2OSwiZW5kIjo4MDEzfSwiZ1ZFSkI1dUpJcGNFeE0z
cyI6eyJ0ZXh0IjoiZm9sbG93aW5nIGF0dGFjayIsInN0YXJ0Ij
o4Mjg5LCJlbmQiOjgzMDV9LCJHTmJEN0poVXR4OWhjWHFTIjp7
InRleHQiOiJvcnBoYW5lZCIsInN0YXJ0Ijo5MjUwLCJlbmQiOj
kyNTh9LCJucUY3Y2xjWDhQdnI5bmxVIjp7InRleHQiOiJGaW5h
bGl0eSIsInN0YXJ0IjoxMTMzNSwiZW5kIjoxMTM0M30sIkdGem
N0RFFSeUZmenk5dngiOnsidGV4dCI6IlBlcmlvZGljYWxseSIs
InN0YXJ0Ijo2MjU0LCJlbmQiOjYyNjZ9LCI1MjZ3MTBCOVF4TD
dkR1lmIjp7InRleHQiOiJHcmFkZSAxIiwic3RhcnQiOjEyMTg0
LCJlbmQiOjEyMTkxfSwiTXJ3MUlHbnBaQkNiSkRMaiI6eyJ0ZX
h0IjoiLiIsInN0YXJ0IjoxNDAxNywiZW5kIjoxNDAxOH0sInVj
cVNxakZMWFB2c3VWR1QiOnsidGV4dCI6IlJlbW92ZSBtZXNzYW
dlSUQgZnJvbSBgcGVuZGluZ2AgaWYgcHJlc2VudFxuKiBSZW1v
dmUgbWVzc2FnZUlEIGZyb20gYGVsaWdpYmxlVGlw4oCmIiwic3
RhcnQiOjE1MTUwLCJlbmQiOjE1Mjg3fSwibFU5djdGdzJ0V0hL
S25PYyI6eyJ0ZXh0IjoiRGVsdGE+bWVzc2FnZUlELnRpbWVzdG
FtcC1tZXNzYWdlSUQucGFyZW50MS50aW1lU3RhbXAgPjAiLCJz
dGFydCI6NDg3NCwiZW5kIjo0OTMwfX0sImNvbW1lbnRzIjp7Il
hXQzdyQ1dXdTlzRTNSOHYiOnsiZGlzY3Vzc2lvbklkIjoia2tF
b2dWaHhwT2taVnJXRSIsInN1YiI6ImdoOjUxMTEyNjE4IiwidG
V4dCI6IlRoaXMgaXMgYSBzdHJvbmcgYXNzdW1wdGlvbiBhbmQg
bWF5IGJlIGludGVycHJldGVkIGluIGEgd3Jvbmcgd2F5LiBXaG
F0IGhhcHBlbnMgb2Ygb25lIG1lc3NhZ2UgaXMgbm90IGRlbGl2
ZXJlZCBvbiB0aW1lPyBQcm90b2NvbCBicmVha3M/IiwiY3JlYX
RlZCI6MTU5NTU3MjYyNDkzM30sIkljOXNmd3lWcDl4dlJYZkki
OnsiZGlzY3Vzc2lvbklkIjoiTVJNamVyamh5NGJZR0VrbyIsIn
N1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IklzIHRoaXMgdGhl
IE1lc3NhZ2UgSW5ib3ggZnJvbSAxLTMgPyIsImNyZWF0ZWQiOj
E1OTU1NzI3NTUzNjF9LCJBUWcybWlyNnVYcENPSTE2Ijp7ImRp
c2N1c3Npb25JZCI6Ik1STWplcmpoeTRiWUdFa28iLCJzdWIiOi
JnaDo1MTExMjYxOCIsInRleHQiOiJQcm9iYWJseSBvbmx5IHRo
ZSBzdWJzZXQgdGhhdCBpcyBub24tZWxpZ2libGUuIiwiY3JlYX
RlZCI6MTU5NTU3Mjc5MzY5M30sIkZZWFVXN1VPWTVlb3NKQmoi
OnsiZGlzY3Vzc2lvbklkIjoiWEhXdG1xOW4wbGNVUEh5biIsIn
N1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Im1lc3NhZ2VJRD8i
LCJjcmVhdGVkIjoxNTk1NTcyOTg2ODE3fSwiYXlUWmtQazdyWX
ROYkFaQyI6eyJkaXNjdXNzaW9uSWQiOiJsV01EYWk0V2xDOUd2
cGVxIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ijoibm90IG
NsZWFyIHdpdGhvdXQga25vd2luZyB3aGF0IGl0IGlzIGFscmVh
ZHkiLCJjcmVhdGVkIjoxNTk1NTczNDQwMjUzfSwiQWdGTk5YSG
txTUxnVzUzayI6eyJkaXNjdXNzaW9uSWQiOiJIcWRXV0RUUGt4
TzJvdHVaIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiZG
9uIHQgdW5kZXJzdGFuZCIsImNyZWF0ZWQiOjE1OTU1NzM0Nzkx
MDh9LCJCWU5QdXVEWlVMSlVSNkFlIjp7ImRpc2N1c3Npb25JZC
I6ImhOQ0tURGRlMzhhdTVZdXUiLCJzdWIiOiJnaDo1MTExMjYx
OCIsInRleHQiOiJTdHJpY3RseSBzcGVha2luZyB0aGlzIGlzIG
5vdCBhIHRpbWUsIG1vcmUgYSBwb2ludCBpbiB0aW1lICh3ZSBi
ZWxpZXZlIHRvIGxpdmUgaW4pLiBVTklYLXRpbWU/IiwiY3JlYX
RlZCI6MTU5NTU3NDUzMjg3M30sIlpQdnVvRkxnVnJVbVgyYkci
OnsiZGlzY3Vzc2lvbklkIjoiWVpPZzd6YzFyYk9HZmxkWiIsIn
N1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IndoZXJlIHdpbGwg
dGhleSBiZSBzdG9yZWQ/IiwiY3JlYXRlZCI6MTU5NTU3NDYzNj
U3OX0sIktpNm1kaW9QU0dpT0tqc1ciOnsiZGlzY3Vzc2lvbklk
IjoiOFptQ0VzaWh6WEpGTTkxMiIsInN1YiI6ImdoOjUxMTEyNj
E4IiwidGV4dCI6Im1ha2UgY29uc2lzdGVudDsgc3RhcnQgdXBw
ZXIgb3IgbG93ZXIgY2FzZSBhZnRlciAnICcsIG9yIHVzZSA6ID
8iLCJjcmVhdGVkIjoxNTk1NTc0NzY3MDU5fSwicTNPUTlCb2dv
NDhoVTRUcCI6eyJkaXNjdXNzaW9uSWQiOiI4Wm1DRXNpaHpYSk
ZNOTEyIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoidXNl
IHRoZSBzYW1lIHRocm91Z2hvdXQgdGhlIHNwZWNzIiwiY3JlYX
RlZCI6MTU5NTU3NDgxMjcxNn0sInZZajM0VXpIRnRPdWtIc0gi
OnsiZGlzY3Vzc2lvbklkIjoiT3FZZHJZc3lhcmJIb1lFZyIsIn
N1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6ImN1cnJlbnQgbG9j
YWwgdGltZT8iLCJjcmVhdGVkIjoxNTk1NTc1MDA5MjY1fSwiYW
FSNTNSYlpqcmFOUWhqbyI6eyJkaXNjdXNzaW9uSWQiOiJPcVlk
cllzeWFyYkhvWUVnIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZX
h0IjoiaWYgaXQgcmVmZXJzIHRvIHRoZSB2YXJpYWJsZSBgY3Vy
cmVudCB0aW1lYGFkZCB0aGVzZSBgcyIsImNyZWF0ZWQiOjE1OT
U1NzUwODYzOTl9LCJ2S0dBRWM3RWQzREwzQzVzIjp7ImRpc2N1
c3Npb25JZCI6IkxSc3VMcEtjbzIwVGxUZTMiLCJzdWIiOiJnaD
o1MTExMjYxOCIsInRleHQiOiJCVFcgd2hlcmUgaXMgaXQgc3Bl
Y2lmaWVkIGhvdyB0byBjaG9vc2UgdyBhbmQgdGhlIG90aGVyIH
BhcmFtZXRlcnM/IiwiY3JlYXRlZCI6MTU5NTU3NTE0MzQzN30s
IlRwM1B4WVVtTjhEcHV2ZWsiOnsiZGlzY3Vzc2lvbklkIjoiZl
Jnc0ZabnJUY2ZlMjRiMyIsInN1YiI6ImdoOjUxMTEyNjE4Iiwi
dGV4dCI6IklzIHRoaXMgYWZ0ZXIgdGhlIG1lc3NhZ2UgcGFzc2
VkIHRoZSByYXRlIG1hbmFnZXI/IElmIHllcywgSSBtIGEgYml0
IGNvbmZ1c2VkLCBub2RlIHdpdGggZGlmZmVyZW50IG1hbmEgcG
VyY2VwdGlvbiBtaWdodCBoYW5kbGUgdGhlIG1lc3NhZ2UgZGlm
ZmVyZW50bHkiLCJjcmVhdGVkIjoxNTk1NTc1NTYzMTcwfSwiVj
RkS2Jmd1E3UFhCRkljNiI6eyJkaXNjdXNzaW9uSWQiOiJKNmly
SHJFdVVsUmlNUjBlIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZX
h0IjoiRG9lcyB0aGlzIGNvbWUgYmVmb3JlIHRoZSBhYm92ZSBz
dGVwIG9yIGFmdGVyPyBBIGdyYXBoIGxpa2UgaW4gMS0zIHNob3
dpbmcgdGhlIHByb2Nlc3NlcyBtaWdodCBiZSBnb29kIiwiY3Jl
YXRlZCI6MTU5NTU3NjEyNTczMX0sIkxQdlV0RFE1T2Vsazh5Qz
UiOnsiZGlzY3Vzc2lvbklkIjoiSjZpckhyRXVVbFJpTVIwZSIs
InN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Ik9yIGlzIHRoaX
MgY29udGFpbmVkIGluIHRoZSB0aW1lc3RhbXAgY2hlY2sgaW4g
MS0zPyIsImNyZWF0ZWQiOjE1OTU1NzYyOTYyNTZ9LCJrM1hEWF
VSaDF5dDVpN3dXIjp7ImRpc2N1c3Npb25JZCI6ImpTd2ZPY21a
M0J1YWpyb1MiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOi
Jkb24gdCB1bmRlcnN0YW5kPyBJcyB0aGlzIGdldFRpcCBmb3Ig
bmV3IG1lc3NhZ2UuSUQ/IiwiY3JlYXRlZCI6MTU5NTU3NjkyMz
YyOH0sIjVYdnNTTHowcW5HdGZhcWIiOnsiZGlzY3Vzc2lvbklk
IjoibWVDRUlwWjV4TE1LdWNnTSIsInN1YiI6ImdoOjUxMTEyNj
E4IiwidGV4dCI6IndoZXJlIGlzIHRoaXMgZGVmaW5lZD8iLCJj
cmVhdGVkIjoxNTk1NTc3MTgxMjU5fSwid2V0TzZGQU9hZGJZNF
plZSI6eyJkaXNjdXNzaW9uSWQiOiJET29sN0pJWE9PYkxFdFhG
Iiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiVGhpcyBzaG
91bGQgYmUgY2FsY3VsYWJsZS4gVW5kZXIgc29tZSBhc3N1bXB0
aW9ucyBvZiBtYWxpY2lvdXMgbXBzIGFuZCBob25lc3QgbXBzIG
V2ZW4gdGhlb3JldGljYWxseS4iLCJjcmVhdGVkIjoxNTk1NTc3
NjMxNzU2fSwibGp3b1NzN0FPWlU0ZUczcSI6eyJkaXNjdXNzaW
9uSWQiOiJLVVVQV25IMzEwWVBQNm5EIiwic3ViIjoiZ2g6NTEx
MTI2MTgiLCJ0ZXh0IjoiSXMgdGhpcyB0aGUgZGVmaW5pdGlvbi
BvZiBjb25maWRlbmNlIGxldmVsPyIsImNyZWF0ZWQiOjE1OTU1
Nzc5NjUzMzF9LCJlS0NJRW9TdzI4cXBVS1hOIjp7ImRpc2N1c3
Npb25JZCI6ImcyTUZ4OWNCWm9oU0V3UWUiLCJzdWIiOiJnaDo1
MTExMjYxOCIsInRleHQiOiJ3aGVyZSBpcyB0aGlzIGRlZmluZW
Q/IiwiY3JlYXRlZCI6MTU5NTU3ODAyODcwMX0sIkRUcWRoQTE4
aDF3cFJ3bnUiOnsiZGlzY3Vzc2lvbklkIjoiZWNSVDB1ZzRPTF
V1WnpjYyIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Imlz
IHRoZXJlIGEgY2hhbmNlIHRoYXQgYSBtZXNzYWdlIGdldHMgdH
JhcHBlZCBpbiB0aGUgTWVzc2FnZSBJbmJveCBhbmQgaGFzIHRv
IGJlIHJlbW92ZWQgdG9vPyIsImNyZWF0ZWQiOjE1OTU1Nzg0OD
g1NTF9LCJiZW85NHd1Y1daaUxHYUpaIjp7ImRpc2N1c3Npb25J
ZCI6IkNOc1hCdkEzRHo4SWc2WGkiLCJzdWIiOiJnaDo1MTExMj
YxOCIsInRleHQiOiJXaGF0IGhhcHBlbnMgaWYgZWxpZ2libGVU
aXBzTGlzdCBpcyBlbXB0eSBmb3IgYWxsIG5vZGVzPyBTaG91bG
QgbnQgd2UgdGhpbmsgYWJvdXQgaGFuZGxpbmcgdGhpcyBjYXNl
PyIsImNyZWF0ZWQiOjE1OTU1Nzg2MzExMzZ9LCJyR1RyMVZGMG
1GUWNqZDI4Ijp7ImRpc2N1c3Npb25JZCI6IkxSc3VMcEtjbzIw
VGxUZTMiLCJzdWIiOiJnaDo2ODI1MDM1MCIsInRleHQiOiJVc3
VhbGx5IFNlcmd1ZWkgc2F5cyBcIlB1dCBhbnkgcmVhc29uYWJs
ZSBpbml0aWFsIHBhcmFtZXRlciBhbmQgd2UgY2hhbmdlIGFmdG
VyIHRlc3RpbmdcIi4iLCJjcmVhdGVkIjoxNTk1ODc5Mzc3NzAw
fSwiZTdKWVpEaVBwazNHeGpBZSI6eyJkaXNjdXNzaW9uSWQiOi
JKNmlySHJFdVVsUmlNUjBlIiwic3ViIjoiZ2g6NjgyNTAzNTAi
LCJ0ZXh0IjoiRnJvbSB0aGUgbGFzdCBkaXNjdXNzaW9uIGZyb2
0gdGhlIGdyb3VwLCBCTUQgY2hlY2sgaXMgcGFydCBvZiBzb2xp
ZGlmaWNhdGlvbiwgcGVoYXBzIHdlIG5lZWQgdG8gY2hhbmdlIH
Nlc3Npb25zIHRvIHJlZmxlY3QgdGhpcz8gSSB3aWxsIGRpc2N1
c3MgdGhpcyBpbiB0aGUgcHJvdG9jb2wgY2FsbCB0b21vcnJvdy
EiLCJjcmVhdGVkIjoxNTk1ODc5NzAyMzcyfSwiajJxam9LYTU1
b0JBNjM5cyI6eyJkaXNjdXNzaW9uSWQiOiJSS3E5ZWttdVVrVX
dIeGV1Iiwic3ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiUmVw
ZWF0ZWQgXCJNb3Jlb3ZlclwiLCB1c2Ugb3RoZXIgd29yZCBsaW
tlIFwiQWRkaXRpb25hbGx5XCIiLCJjcmVhdGVkIjoxNTk1ODgw
MDQyNTYxfSwiRVI0bUtCcEU3TWEyVDU2ZSI6eyJkaXNjdXNzaW
9uSWQiOiJsQnZndGJHYUJUdmZWU1lnIiwic3ViIjoiZ2g6Njgy
NTAzNTAiLCJ0ZXh0IjoiSU9UQSIsImNyZWF0ZWQiOjE1OTU4OD
AwNzQyNTN9LCJMWjRya1pGVGM3eGZJNjlSIjp7ImRpc2N1c3Np
b25JZCI6IlVzUGxaRTFYQXVzMDdTTDAiLCJzdWIiOiJnaDo2OD
I1MDM1MCIsInRleHQiOiJJcyBpdCBvayB0byB1c2UgdGhlIG1h
dGhlbWF0aWNhbCB0ZXJtaW5vbG9neSBoZXJlPyIsImNyZWF0ZW
QiOjE1OTU4ODA3NDA1MDF9LCJwdXlIRGNmMlVmVm5kcm9CIjp7
ImRpc2N1c3Npb25JZCI6IlBKQnh3SmZhTUMwYzBLNmkiLCJzdW
IiOiJnaDo2ODI1MDM1MCIsInRleHQiOiJXZSBuZWVkIHRvIGRl
ZmluZSBhdHRhY2tzIHNvbWV3aGVyZS4gQWxzbywgZG9lcyBpdC
BtYWtlIHNlbnNlIHRvIGhhdmUgYSBibG93YmFsbCBhdHRhY2sg
d2l0aCBubyBtaWxlc3RvbmVzPyIsImNyZWF0ZWQiOjE1OTU4OD
A4MDMzODh9LCJPeURQeXNyTUpjYzBlblZuIjp7ImRpc2N1c3Np
b25JZCI6ImlTYU1MbXNNNmVNS0NqeEoiLCJzdWIiOiJnaDo2OD
I1MDM1MCIsInRleHQiOiJJIGJlbGlldmUgd2UgY2FuIGJlIHBy
ZWNpc2UgaGVyZSB3aXRoIHNvbWUgbWF0aCBmcm9tIFRTLi4uIi
wiY3JlYXRlZCI6MTU5NTg4MDg2ODA0OX0sInU2U3BPR2RZQTlq
dmduckQiOnsiZGlzY3Vzc2lvbklkIjoid05Hd3Q4dDNqeHg0a1
pXMyIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4dCI6Iklzbid0
IGNoZWNraW5nIHBhc3QgY29uZSBqdXN0IGFzIGV4cGVuc2l2ZT
8iLCJjcmVhdGVkIjoxNTk1ODgwOTEzODExfSwidExxRE5vY050
SjJXT0pGRiI6eyJkaXNjdXNzaW9uSWQiOiJnVkVKQjV1SklwY0
V4TTNzIiwic3ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiUGVo
YXBzIGEgc2VjdGlvbiBkZXNjcmliaW5nIHBvc3NpYmxlIGF0dG
Fja3Mgd291bGQgbWlrZSB0aGUgZmlsZSBjbGVhbmVyIiwiY3Jl
YXRlZCI6MTU5NTg4MTExMTU2N30sIlJNaTBNclFSSlRwRVJBZz
QiOnsiZGlzY3Vzc2lvbklkIjoiR05iRDdKaFV0eDloY1hxUyIs
InN1YiI6ImdoOjY4MjUwMzUwIiwidGV4dCI6IldlIG5lZWQgdG
8gZGVmaW5lIHRoZSB0ZXJtIFwib3JwaGFuYWdlXCIgYmVmb3Jl
IHVzaW5nIGl0IiwiY3JlYXRlZCI6MTU5NTg4MTM4NTUyNH0sIm
5nbWlSSE9QbExZUTA2VWwiOnsiZGlzY3Vzc2lvbklkIjoibnFG
N2NsY1g4UHZyOW5sVSIsInN1YiI6ImdoOjY4MjUwMzUwIiwidG
V4dCI6IkZvbGxvd2luZyBTZWJhc3RpYW5zIENvbW1lbnRzIEkg
d291bGQgc3VnZ2VzdCB0aGlzIHNlY3Rpb24gdG8gY29tZSBiZW
ZvcmUsIHNpbmNlIHdlIG1hbnkgdGltZXMgdGFsayBhYm91dCBv
cnBoYW5hZ2UgYW5kIGZpbmFsaXR5IGJlZm9yZS4iLCJjcmVhdG
VkIjoxNTk1ODgyMjM4MjcwfSwiNGNNMkU4QWdBbGwwMzQ3YiI6
eyJkaXNjdXNzaW9uSWQiOiJHRnpjdERRUnlGZnp5OXZ4Iiwic3
ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiVGhpcyBzaG91bGQg
aW5kdWNlIGEgbmV3IHBhcmFtZXRlciIsImNyZWF0ZWQiOjE1OT
U4OTcyNDgzMDZ9LCJQNjVvRXNBRFdvZ0x2cWtFIjp7ImRpc2N1
c3Npb25JZCI6IjUyNncxMEI5UXhMN2RHWWYiLCJzdWIiOiJnaD
o2ODI1MDM1MCIsInRleHQiOiJXZSBpbml0aWFsbHkgaW50cm9k
dWNlZCA0IGdyYWRlcywgc28gd2UgY291bGQgaGF2ZSBvbmUga2
luZCBvZiBmaW5hbGl0eSBpbiBzb21lIHNlY29uZHMgKHRoZSBz
bWFsbCBuZXR3b3JrIGRlbGF5IHdpdGggbm8gY29uZmxpY3RzKS
wgSSBmZWVsIGxpa2UgY2hhbmdpbmcgaXQgaXMgYmFkIGZvciBQ
Ui4iLCJjcmVhdGVkIjoxNTk1ODk3OTgzODMwfSwiWGttdUpnS2
pISGdkazYyRyI6eyJkaXNjdXNzaW9uSWQiOiJNcncxSUducFpC
Q2JKRExqIiwic3ViIjoiZ2g6NjgyNTAzNTAiLCJ0ZXh0IjoiOi
IsImNyZWF0ZWQiOjE1OTU4OTgwNDA1MzZ9LCIzSHhFc2R1UXMx
VXFMblpCIjp7ImRpc2N1c3Npb25JZCI6InVjcVNxakZMWFB2c3
VWR1QiLCJzdWIiOiJnaDo2ODI1MDM1MCIsInRleHQiOiJTaG91
bGRuJ3QgdGhpcyBiZSBpbiBwc2V1ZG8tQWxnb3JpdGhtPyIsIm
NyZWF0ZWQiOjE1OTU4OTg4MDkxNzF9LCJxRlJzcmhtOUZJSmF0
dk5UIjp7ImRpc2N1c3Npb25JZCI6ImxVOXY3RncydFdIS0tuT2
MiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJJbiBwYXJ0
aWN1bGFyLCB0aGlzIGVuZm9yY2VzIG1vbm90b25pY2l0eSBvZi
B0aW1lc3RhbXBzLCBcIj4wXCIsIFRoaXMgaXMgc29tZWhvdyBo
aWRkZW4gaGVyZSBhbmQgc2hvdWxkIGJlIG1vdmVkIHRvIFRpbW
VzdGFtcENoZWNrIiwiY3JlYXRlZCI6MTU5NTkxNTI4MDA0OX0s
Ik5tblowMW1iT0I4R3RYS2IiOnsiZGlzY3Vzc2lvbklkIjoia2
tFb2dWaHhwT2taVnJXRSIsInN1YiI6ImdoOjUwNjYxODQ0Iiwi
dGV4dCI6IkJhc2ljYWxseS4gIEEgbm9kZSBpcyB0aHJvd24gb3
V0IG9mIHN5bmMuIiwiY3JlYXRlZCI6MTU5NTkyNTA2MTQ2OH0s
Ik1OV2g1bzJ4QWxXa25ORTAiOnsiZGlzY3Vzc2lvbklkIjoibF
dNRGFpNFdsQzlHdnBlcSIsInN1YiI6ImdoOjUwNjYxODQ0Iiwi
dGV4dCI6IkltIG5vdCBzdXJlIGhvdyB0byBkZWZpbmUgaXQgaW
4gY29uY2lzZSB3YXkuIiwiY3JlYXRlZCI6MTU5NTkyNTExMDY2
OH0sIlFITHoxVEVDa0NFc3pTQTkiOnsiZGlzY3Vzc2lvbklkIj
oiTVJNamVyamh5NGJZR0VrbyIsInN1YiI6ImdoOjUwNjYxODQ0
IiwidGV4dCI6IlRoZSBlbGlnaWJpbGl0eSBzdGF0dXMgaXMgcG
VuZGluZyIsImNyZWF0ZWQiOjE1OTU5MjUyMDk2NDJ9LCJIdXQ0
a09Xb043MlZwVTY3Ijp7ImRpc2N1c3Npb25JZCI6IlhIV3RtcT
luMGxjVVBIeW4iLCJzdWIiOiJnaDo1MDY2MTg0NCIsInRleHQi
OiJUaGlzIGhhcyB0byBiZSBkZWZpbmVkIGluIGFub3RoZXIgc3
BlY2lmaWNhdGlvbjogdGhlIGhhc2ggb2YgZWFjaCBtZXNzYWdl
IGlzIHRoZSBNZXNzYWdlSUQiLCJjcmVhdGVkIjoxNTk1OTI1Mj
U2MjQ2fSwiM3lqTjBVbUx6dzVTbUlHMiI6eyJkaXNjdXNzaW9u
SWQiOiJoTkNLVERkZTM4YXU1WXV1Iiwic3ViIjoiZ2g6NTA2Nj
E4NDQiLCJ0ZXh0IjoiSSB0aGluayBpdCB3aWxsIGJlIFVOSVgg
dGltZSIsImNyZWF0ZWQiOjE1OTU5MjUyODczMDZ9LCI3aDlMeF
VCRUdudHdRVk8yIjp7ImRpc2N1c3Npb25JZCI6IllaT2c3emMx
cmJPR2ZsZFoiLCJzdWIiOiJnaDo1MDY2MTg0NCIsInRleHQiOi
JUaGF0IGlzIGJleW9uZCB0aGUgc2NvcGUgb2YgdGhpcyBkb2N1
bWVudCIsImNyZWF0ZWQiOjE1OTU5MjUzMzg4MTh9LCJ6VFNpSG
YxM0hsVmloRWk0Ijp7ImRpc2N1c3Npb25JZCI6IjhabUNFc2lo
elhKRk05MTIiLCJzdWIiOiJnaDo1MDY2MTg0NCIsInRleHQiOi
JJIGRvbnQgdW5kZXJzdGFuZD8iLCJjcmVhdGVkIjoxNTk1OTI1
NDM5ODc4fSwibzRPeVA1MTNFbkI5d2h2ayI6eyJkaXNjdXNzaW
9uSWQiOiJmUmdzRlpuclRjZmUyNGIzIiwic3ViIjoiZ2g6NTA2
NjE4NDQiLCJ0ZXh0IjoiVGhhdCBpcyB0cmVhdGVkIGluIHRoZS
BkYXRhIHByb2Nlc3Npbmcgc3BlYyIsImNyZWF0ZWQiOjE1OTU5
MjU1MDAxNzh9LCJGSTRLbU5pQ2gyV0xINTcwIjp7ImRpc2N1c3
Npb25JZCI6Iko2aXJIckV1VWxSaU1SMGUiLCJzdWIiOiJnaDo1
MDY2MTg0NCIsInRleHQiOiJUaGlzIDEsMiwzIGlzIGxpc3RlZC
BpbnQgaGUgZGF0YSBwcm9jZXNzaW5nIHNwZWMsIHNpbmNlIHRo
ZXNlIGNvbXBvbmVudHMgYXJlIGludGVydHdpbmVkIHdpdGggdG
hlIG90aGVyIHBhcnRzIG9mIHRoZSBwcm90b2NvbC4iLCJjcmVh
dGVkIjoxNTk1OTI1NTYyODEwfSwiVGloeW5XMEtPTjU4cHRQUi
I6eyJkaXNjdXNzaW9uSWQiOiJsVTl2N0Z3MnRXSEtLbk9jIiwi
c3ViIjoiZ2g6NTA2NjE4NDQiLCJ0ZXh0IjoiVGhpcyBpcyBhIG
JlbG93IG1heCBkZXB0aCBpc3N1ZS4gIFRocmVlIGlzIGEgaGFy
ZCBjcml0ZXJpb24gdGltZXN0YW1wIGNyaXRlcmlvbiB0aGV5IG
5lZWQgdG8gc2F0aXNmeS4iLCJjcmVhdGVkIjoxNTk1OTI1NjM5
MDc4fSwiRVBnVHlRMGpMM3FOQWJUNiI6eyJkaXNjdXNzaW9uSW
QiOiJDTnNYQnZBM0R6OElnNlhpIiwic3ViIjoiZ2g6NTA2NjE4
NDQiLCJ0ZXh0IjoiVGhlIHRhbmdsZSBkaWVzLiAgSSBkb250IH
RoaW5rIHRoaXMgaXMgbGlrZWx5LiIsImNyZWF0ZWQiOjE1OTU5
MjU3MjM2NjZ9fSwiaGlzdG9yeSI6Wy0zODM4ODQ0OTMsLTExMD
IzMzQ3OTRdfQ==
-->