# Specification on Data Processing (WIP)

This section objective is to describe the functionality of a node, as well to determine how the Coordicide modules work and interact with each other. 

# Terminology 

The main elements defined here are

1. Data Set (**DATA**): Data elements that store information.
2. Communication Port (**PORT**): Communication ports used to exchange data among nodes or with external actors.
3. Logic Process (**PROCESS**): A set of actions the node take interacting with the other elements. 



We also consider the possible functions performed by a PROCESS:

* CALL(PROCESS A): Running **PROCESS** activates  **PROCESS** A.
* WRITE($x$, **DATA** A): Running **PROCESS** writes entry $x$ in the storage **DATA** A.
* DELETE($x$, **DATA** A): Running **PROCESS** deletes entry $x$ in the storage **DATA** A.
* READ(*info* ,**DATA** A): Return from the storage **DATA** A the data related to input *info*.



# PROCESS Anatomy

Now we show how we will present the different processes, showing their different interactions. The main elements of our representation are as follows:
![](https://i.imgur.com/WuHlwWl.png)

As an example, the Message Tangle Solidification **PROCESS** it is represented by
![](https://i.imgur.com/YSjdBOP.png)

For each process we will give a resumed description of its functionality and link to the appropriate section where it will be described in details.

# List of Ports and Data Sets

The following ports will be used in the processes:

* **Autopeering Request Port:** The port used by nodes to send and receive packets related to the Autopeering mechanism. 
* **Gossip Port:** The port by nodes for the exchange of messages and notifications between neighbor nodes.
* **FPC Voting Port:** The port nodes will use to send and receive FPC votes.
* **Message Creation Port:** The port where Users will be able to send transactions to nodes to create their messages. 
* **Finality Inquiry Port:** The port where both Users and Nodes will be able to check the status of their transaction. 

The following message data sets will be used in the processes:
* **Message Inbox:** A data set where non-duplicated messages will stay until processed by the node and added to the Tangle. 
* **Solidification Buffer:** A data set where messages that were not able to quick-solidify will be kept until the missing messages arrive.
* **Message Tangle:** The main data set where all the non-snapshotted messages are kept. 
* **Rate Manager Outbox:** A data set where messages that were processed are kept until they are gossiped further. 

The following other data sets will be used in the processes:
* **Node List:** The list of nodes known by the current Node. 
* **Nodes Information Database:** A database of quantities related to the nodes that are used for the protocol, such as "Mana Value", "Effective Mana", "Recent transactions arrivals", etc. 
* **Ledger State:** A list with the current balance on each address and node. 


# Main Message Processing Diagram 

The Main Message processor constitutes of 8 processes that constitutes of all actions the node do with a message from the moment it is received until it is included on its Tangle and further gossiped. The 8 processes are: "Duplicate Detector", "Node Signature Validator", "Timestamp Opinion and Filter", "Proof of Work Check", "Solidifier", "Rate Manager" and "Gossip Scheduler".

Ignoring the possible data sets and ports used, the processes are ordered as:

![](https://i.imgur.com/xFjNlFd.png)


1. **Duplicate Detector**
The Duplicate Detector is triggered each time a message arrives in the gossip port. It will look if there if the exact same message has already arrived before, being either on the Message Tangle or in the Message Inbox. The message will only be added to the Message Inbox in case it is not found in both data sets.
![](https://i.imgur.com/5Ke3jId.png)

2. **Node Signature Validator**
The Node Signature Validator will timely get messages from the Message Inbox and check if its signature is valid. Messages that fail this verification are deleted from the Message Inbox.
![](https://i.imgur.com/mOrfhqz.png)

3. **Timestamp Opinion and Filter**
This process will compare the arrival time of the message with its declared timestamp in order to define the proper Level of Knowledge of the timestamp of the message. Messages that receive a rating of "Level 3 Bad Timestamp" will be deleted from the Message Inbox. 
![](https://i.imgur.com/lVa7H5L.png)

4. **Proof of Work Check**
This Process will check if the required proof of work was done by the node, if it fails then the message is deleted from the Message Inbox.
![](https://i.imgur.com/sn7UJFD.png)

5. **Solidifier**
This process will check if all messages in the past cone of the transaction are included in either the Message Inbox or in the Message Tangle. In case it is not, then the process will include the message in the Solidification Buffer until the missing messages arrive during a waiting time. If the missing messages do not arrive, the last action will be to demand from neighbor nodes the missing messages. If the last step ends in a failure, the message is dropped from the Message Inbox and proper action against the nodes is taken. 
![](https://i.imgur.com/YSjdBOP.png)\

6. **Rate Manager**
This process will check if the message is within the issuer node allowed rate, and will give a feedback message in case it is violating such limits. It may also trigger a "Sever Connection with Node" action in case of excessive number of violations.

8. **Gossip Scheduler**
The Gossip Scheduler will take messages in the Processor Outbox following priority parameters, further gossip it to the processing node neighbours and write it on the Message Tangle. 



# Value Message Processing Diagram 

The processes of the Value Tangle are 

1. **Duplicate Detector**
This Duplicator Detector will check if the transaction is already included in the Value Tangle. This will also define the Epoch of the transaction. If two duplicate transactions are sent in the same Epoch, they are considered the same, while under different epochs one is considered an reattachment. 

2. **Validator**
The Validator will check the UTXO inputs to see if the funds being transfered exists and will also remove value messages with no funds veing moved. 


3. **Conflict Check**
Here we will set the status of the transaction according to the existence of conflicts with the data you already have on the Tangle. If no conflict is found then the transaction is flagged "non-eligible", what means it is still not ready for tip selection but has no other problems. In case a conflict is found and the conflicting transaction is "non-eligible", then both the transactions will be flagged "Vote Pending", and after FPC they will be categorized as either "Eligible" or "Disliked". Finally if a conflict is found but the conflicting transaction is already "Eligible", then the most recent one will be flagged as "Disliked".


# Independent Processes

The Processes that are not part of the main message processing are

* **Mana Updater**
The Mana Updater is called when a messages enter Level 3 Finality, updating the Mana accordingly in the Nodes Information Database. 
* **Tip Selector**
Following the Weighted Tip Selection described in XXX, the Tip Selector when called will return two messages chosen independently from the Eligible list (potentially the same), where the selection follows the mentioned algorithm. 
* **Snapshotter**
The Snappshotter will erase all appropriatte information from the Message Tangle of old enough transactions that are considered confirmed and Level 3 Final. This process may be automated. 
* **Payload Parser**
The Payload Parser is the process that identify the payload the message carries, see if the node has the capability to process it and call the approppriate processes for it. 
* **Value Tip Selector**
The Value Tip Selector works similarly to the Tip Selection, but it changes the eligibility for a value message to be a tip since it needs to be solid.
* **Finalization Tracker**
The Finalization Tracker update the Finality level of transaction according to the criteria defined for each level. 



<!--stackedit_data:
eyJkaXNjdXNzaW9ucyI6eyJ1WnFsUlZyU3ViSGYxYzA4Ijp7In
RleHQiOiJUaGUgcG9ydCByZXNwb25zaWJsZSBmb3IgdGhlIHBh
Y2tldHMgbmVlZGVkIHRvIG5vZGVzIHRvIHVzZSB0aGUgQXV0b3
BlZXJpbmcgbWVj4oCmIiwic3RhcnQiOjE1MzUsImVuZCI6MTYx
Nn0sInVIcEs0akRGZG1nUVVYUXgiOnsic3RhcnQiOjI0MzAsIm
VuZCI6MjQ0NSwidGV4dCI6Im5vbi1zbmFwc2hvdHRlZCJ9LCJz
N1BuQmQ0aVpvOFByaEhTIjp7InN0YXJ0IjoyNzExLCJlbmQiOj
I3MzcsInRleHQiOiJOb2RlcyBJbmZvcm1hdGlvbiBEYXRhYmFz
ZSJ9LCJIMExjTTlYVVdXbVMwd1QwIjp7InN0YXJ0IjozMDE0LC
JlbmQiOjMyMTMsInRleHQiOiJUaGUgTWFpbiBNZXNzYWdlIHBy
b2Nlc3NvciBjb25zdGl0dXRlcyBvZiA3IHByb2Nlc3NlcyB0aG
F0IGNvbnN0aXR1dGVzIG9mIGFsbCBh4oCmIn0sImc2WkRTQjF4
dGY1UVRDMWciOnsic3RhcnQiOjMyODcsImVuZCI6MzMxNSwidG
V4dCI6IlRpbWVzdGFtcCBPcGluaW9uIGFuZCBGaWx0ZXIifSwi
ZjR0SDh6MUcxMmFmdE8weCI6eyJzdGFydCI6MzM0MiwiZW5kIj
ozMzUyLCJ0ZXh0IjoiU29saWRpZmllciJ9LCJKNXJWbTI0VW9J
ZmRBY0plIjp7InN0YXJ0IjozODU0LCJlbmQiOjM4OTAsInRleH
QiOiIhW10oaHR0cHM6Ly9pLmltZ3VyLmNvbS81S2UzaklkLnBu
ZykifSwiQ1czVTQ4S1daRVpkM04zVSI6eyJzdGFydCI6NDA4Ny
wiZW5kIjo0MTA4LCJ0ZXh0IjoiZnJvbSB0aGUgTWVzc2FnZSBJ
bmJvIn0sIk9idnNOak8waWFuY3psaWUiOnsic3RhcnQiOjQzMD
EsImVuZCI6NDMxOSwidGV4dCI6IkxldmVsIG9mIEtub3dsZWRn
ZSJ9LCJtOUptUHlwalRHRGtKN05nIjp7InN0YXJ0Ijo0NDUyLC
JlbmQiOjQ0ODcsInRleHQiOiIhW10oaHR0cHM6Ly9pLmltZ3Vy
LmNvbS9sVmE3SDVMLnBuZyJ9LCJqd0ExT3lKN3VnVm1lejR5Ij
p7InN0YXJ0Ijo0NjU3LCJlbmQiOjQ2OTMsInRleHQiOiIhW10o
aHR0cHM6Ly9pLmltZ3VyLmNvbS9zbjdVSkZELnBuZykifX0sIm
NvbW1lbnRzIjp7IjBPYzJZZmF1aXh2OFNDclAiOnsiZGlzY3Vz
c2lvbklkIjoidVpxbFJWclN1YkhmMWMwOCIsInN1YiI6ImdoOj
UxMTEyNjE4IiwidGV4dCI6InRoZSBwb3J0IGZvciBhdXRvcGVl
cmluZyBwcm90b2NvbC9yZXF1ZXN0cz8gRG9uIHQgdW5kZXJzdG
FuZCB3aGF0IHRoZSBkZWNpc2lvbiBvbiAgd2hvIHRvIGNvbm5l
Y3QgaGFzIHRvIHRvIHdpdGggdGhlIHBvcnQuIiwiY3JlYXRlZC
I6MTU5NTQyMDk3NzU1NH0sIjNjQUVXMmZwdHRVRnFvME4iOnsi
ZGlzY3Vzc2lvbklkIjoidVpxbFJWclN1YkhmMWMwOCIsInN1Yi
I6ImdoOjY4MjUwMzUwIiwidGV4dCI6IkkgdHJpZWQgdG8gZ2l2
ZSBhIGJldHRlciB3b3JkaW5nLCB0aGUgb2xkIG9uZSB3YXMgYX
dmdWwuIiwiY3JlYXRlZCI6MTU5NTQ0NDExMTE0Mn0sInUyV1B2
ME5aT1Q0alJPY2giOnsiZGlzY3Vzc2lvbklkIjoidVpxbFJWcl
N1YkhmMWMwOCIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6
InNvIGl0cyB0aGUgc2FtZSBwb3J0IGZvciBzZW5kaW5nIGFuZC
ByZXF1ZXN0aW5nLiBJZiB5ZXMgcGVyaGFwcyBqdXN0IGNhbGwg
aXN0IEF1dG9wZWVyaW5nIFBvcnQiLCJjcmVhdGVkIjoxNTk1NT
AwNTg2MTIyfSwiaDZOdUJESTRwTm42SmpEQyI6eyJkaXNjdXNz
aW9uSWQiOiJ1SHBLNGpERmRtZ1FVWFF4Iiwic3ViIjoiZ2g6NT
ExMTI2MTgiLCJ0ZXh0IjoiZGVmaW5lIHNuYXBzaG90IHNvbWV3
aGVyZSIsImNyZWF0ZWQiOjE1OTU1MDA3MDI5NTV9LCJpVDZVTz
RFVXRwNHVwYWdXIjp7ImRpc2N1c3Npb25JZCI6InM3UG5CZDRp
Wm84UHJoSFMiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOi
JqdXN0IFwiTm9kZSBEYXRhYmFzZVwiPyIsImNyZWF0ZWQiOjE1
OTU1MDA4MTA1MzV9LCJUUUhsejBXUDdWWk9lMnBLIjp7ImRpc2
N1c3Npb25JZCI6IkgwTGNNOVhVV1dtUzB3VDAiLCJzdWIiOiJn
aDo1MTExMjYxOCIsInRleHQiOiJUaGUgTWFpbiBNZXNzYWdlIH
Byb2Nlc3NvciBpcyBkaXZpZGVkIGludG8gNyBzdWItcHJvY2Vz
c2VzOyBjb3ZlcmluZyBhbGwgYWN0aW9ucyBhIG5vZGUgaGFzIH
RvIHBlcmZvcm0gaW4gb3JkZXIgdG8gc2VuZCBhIG1lc3NhZ2Ug
PyIsImNyZWF0ZWQiOjE1OTU1MDA5NzkxNDJ9LCJkRkpMbmd0cm
lTNmp3MWo4Ijp7ImRpc2N1c3Npb25JZCI6IkgwTGNNOVhVV1dt
UzB3VDAiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiI3LT
44IiwiY3JlYXRlZCI6MTU5NTUwMTAwNzM4M30sIkRKVUhRYmZn
MFZMMzh6ZjkiOnsiZGlzY3Vzc2lvbklkIjoiZzZaRFNCMXh0Zj
VRVEMxZyIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IlRp
bWVzdGFtcCBjaGVjaz8iLCJjcmVhdGVkIjoxNTk1NTAxMDMxMj
g3fSwiWDdVZFVHaHR1QThUZk96ciI6eyJkaXNjdXNzaW9uSWQi
OiJmNHRIOHoxRzEyYWZ0TzB4Iiwic3ViIjoiZ2g6NTExMTI2MT
giLCJ0ZXh0Ijoib3IgTVQgU29saWRpZmllcj8iLCJjcmVhdGVk
IjoxNTk1NTAxMDU2NDI0fSwiWmZJQms3dVYwN3lYRmh5ZCI6ey
JkaXNjdXNzaW9uSWQiOiJKNXJWbTI0VW9JZmRBY0plIiwic3Vi
IjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiV2h5IERlbGV0ZSBpbi
BNZXNzYWdlIEluYm94PyIsImNyZWF0ZWQiOjE1OTU1MDEyMDY0
NjB9LCI4a2Nhenh5OWpMNzFXVURhIjp7ImRpc2N1c3Npb25JZC
I6IkNXM1U0OEtXWkVaZDNOM1UiLCJzdWIiOiJnaDo1MTExMjYx
OCIsInRleHQiOiJhZGQgXCJERUxFVEUgTWVzc2FnZSBJbmJveF
wiIiwiY3JlYXRlZCI6MTU5NTUwMTM4NDM2Nn0sIlFBODhKV1dV
RklsbVRxMUgiOnsiZGlzY3Vzc2lvbklkIjoiQ1czVTQ4S1daRV
pkM04zVSIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Ik9u
Y2UgYSBtZXNzYWdlIGlzIGRlbGV0ZWQgZnJvbSBJbmJveCwgZ2
9zc2lwIG1pZ2h0IHB1dCBpdCB0aGVyZSB5ZXQgYW5vdGhlciB0
aW1lID8iLCJjcmVhdGVkIjoxNTk1NTAxNDM2MDM2fSwiVlNXSl
F6WXd6NzV4VmRoQSI6eyJkaXNjdXNzaW9uSWQiOiJPYnZzTmpP
MGlhbmN6bGllIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ij
oiaW50cm9kdWNlIGxpbmsgdG8gRGVmaW5pdGlvbiIsImNyZWF0
ZWQiOjE1OTU1MDE0NzQ4NDl9LCJXNUc3WGNmTkJ2a0hQYVZ5Ij
p7ImRpc2N1c3Npb25JZCI6Im05Sm1QeXBqVEdEa0o3TmciLCJz
dWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJNaXNzaW5nIERFTE
VURSBNZXNzYWdlIElOQk9YLCIsImNyZWF0ZWQiOjE1OTU1MDE1
NDYwMzd9LCI0eWVBbjhUWVVSQnNwekR4Ijp7ImRpc2N1c3Npb2
5JZCI6Im05Sm1QeXBqVEdEa0o3TmciLCJzdWIiOiJnaDo1MTEx
MjYxOCIsInRleHQiOiJBbmQgUkVBRCIsImNyZWF0ZWQiOjE1OT
U1MDE2NjE2MjN9LCJ1M1dzVjJ0aURkQThuWU5FIjp7ImRpc2N1
c3Npb25JZCI6Imp3QTFPeUo3dWdWbWV6NHkiLCJzdWIiOiJnaD
o1MTExMjYxOCIsInRleHQiOiJXcm9uZyBEQiBvcGVyYXRpb247
IFJFQUQvREVMRVRFIE1lc3NhZ2UgSW5ib3giLCJjcmVhdGVkIj
oxNTk1NTAxNzI5NjcwfX0sImhpc3RvcnkiOlstMjA4Njc0MDM4
OSwtMTU4MTk1MTgxMSwtNjQ0MjAyODI4LC0xNzUyNDc2NzcsOD
kwMzU2MzQ5LC02NzY2NDUyMTldfQ==
-->