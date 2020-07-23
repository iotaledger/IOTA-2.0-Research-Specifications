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
The Duplicator Detector will check if the transaction is already included in the Value Tangle. This will also define the Epoch of the transaction. If two duplicate transactions are sent in the same Epoch, they are considered the same, while under different Epochs one is considered a reattachment. 

2. **Validator**
The Validator will check the UTXO inputs to see if the funds being transferred exists and will also remove value messages with no funds being moved. 


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
aHR0cHM6Ly9pLmltZ3VyLmNvbS9zbjdVSkZELnBuZykifSwiYj
RhM2tJeVpsWlJPZFZLRiI6eyJzdGFydCI6NTE3NywiZW5kIjo1
MjQ0LCJ0ZXh0IjoiZnJvbSB0aGUgTWVzc2FnZSBJbmJveCBhbm
QgcHJvcGVyIGFjdGlvbiBhZ2FpbnN0IHRoZSBub2RlcyBpcyB0
YWtlbiJ9LCJmQWtLa1Z2U3VTUWxwclNnIjp7InN0YXJ0Ijo1ND
c4LCJlbmQiOjU1NTUsInRleHQiOiJTZXZlciBDb25uZWN0aW9u
IHdpdGggTm9kZVwiIGFjdGlvbiBpbiBjYXNlIG9mIGV4Y2Vzc2
l2ZSBudW1iZXIgb2YgdmlvbGF0aW9ucy4ifSwiNlNFQk1qZlpy
ZUNWSmFxZCI6eyJzdGFydCI6NTI5MCwiZW5kIjo1MzA0LCJ0ZX
h0IjoiKlJhdGUgTWFuYWdlcioifSwiRzFPd1p1QjNidHg1cmZx
ViI6eyJzdGFydCI6NTU2MiwiZW5kIjo1NTc4LCJ0ZXh0IjoiR2
9zc2lwIFNjaGVkdWxlciJ9LCJ0RklLdWk5eTBmNXJFcnZYIjp7
InN0YXJ0Ijo1ODA1LCJlbmQiOjU4MTIsInRleHQiOiJUaGUgcH
JvIn0sImM2RDlWNVU0VGJFeDU2TXYiOnsic3RhcnQiOjYxMjgs
ImVuZCI6NjEzNCwidGV4dCI6IkVwb2NocyJ9LCJBV2o0VENiWX
c0STVITloxIjp7InN0YXJ0Ijo2NjczLCJlbmQiOjY3MjIsInRl
eHQiOiJhbmQgdGhlIGNvbmZsaWN0aW5nIHRyYW5zYWN0aW9uIG
lzIFwibm9uLWVsaWdpYmxlXCIifSwiRVpsRHBQUk40ZTZIZ1dr
OSI6eyJzdGFydCI6Njg5NCwiZW5kIjo2OTA4LCJ0ZXh0IjoiaG
UgY29uZmxpY3RpbmcifX0sImNvbW1lbnRzIjp7IjBPYzJZZmF1
aXh2OFNDclAiOnsiZGlzY3Vzc2lvbklkIjoidVpxbFJWclN1Yk
hmMWMwOCIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6InRo
ZSBwb3J0IGZvciBhdXRvcGVlcmluZyBwcm90b2NvbC9yZXF1ZX
N0cz8gRG9uIHQgdW5kZXJzdGFuZCB3aGF0IHRoZSBkZWNpc2lv
biBvbiAgd2hvIHRvIGNvbm5lY3QgaGFzIHRvIHRvIHdpdGggdG
hlIHBvcnQuIiwiY3JlYXRlZCI6MTU5NTQyMDk3NzU1NH0sIjNj
QUVXMmZwdHRVRnFvME4iOnsiZGlzY3Vzc2lvbklkIjoidVpxbF
JWclN1YkhmMWMwOCIsInN1YiI6ImdoOjY4MjUwMzUwIiwidGV4
dCI6IkkgdHJpZWQgdG8gZ2l2ZSBhIGJldHRlciB3b3JkaW5nLC
B0aGUgb2xkIG9uZSB3YXMgYXdmdWwuIiwiY3JlYXRlZCI6MTU5
NTQ0NDExMTE0Mn0sInUyV1B2ME5aT1Q0alJPY2giOnsiZGlzY3
Vzc2lvbklkIjoidVpxbFJWclN1YkhmMWMwOCIsInN1YiI6Imdo
OjUxMTEyNjE4IiwidGV4dCI6InNvIGl0cyB0aGUgc2FtZSBwb3
J0IGZvciBzZW5kaW5nIGFuZCByZXF1ZXN0aW5nLiBJZiB5ZXMg
cGVyaGFwcyBqdXN0IGNhbGwgaXN0IEF1dG9wZWVyaW5nIFBvcn
QiLCJjcmVhdGVkIjoxNTk1NTAwNTg2MTIyfSwiaDZOdUJESTRw
Tm42SmpEQyI6eyJkaXNjdXNzaW9uSWQiOiJ1SHBLNGpERmRtZ1
FVWFF4Iiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiZGVm
aW5lIHNuYXBzaG90IHNvbWV3aGVyZSIsImNyZWF0ZWQiOjE1OT
U1MDA3MDI5NTV9LCJpVDZVTzRFVXRwNHVwYWdXIjp7ImRpc2N1
c3Npb25JZCI6InM3UG5CZDRpWm84UHJoSFMiLCJzdWIiOiJnaD
o1MTExMjYxOCIsInRleHQiOiJqdXN0IFwiTm9kZSBEYXRhYmFz
ZVwiPyIsImNyZWF0ZWQiOjE1OTU1MDA4MTA1MzV9LCJUUUhsej
BXUDdWWk9lMnBLIjp7ImRpc2N1c3Npb25JZCI6IkgwTGNNOVhV
V1dtUzB3VDAiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOi
JUaGUgTWFpbiBNZXNzYWdlIHByb2Nlc3NvciBpcyBkaXZpZGVk
IGludG8gNyBzdWItcHJvY2Vzc2VzOyBjb3ZlcmluZyBhbGwgYW
N0aW9ucyBhIG5vZGUgaGFzIHRvIHBlcmZvcm0gaW4gb3JkZXIg
dG8gc2VuZCBhIG1lc3NhZ2UgPyIsImNyZWF0ZWQiOjE1OTU1MD
A5NzkxNDJ9LCJkRkpMbmd0cmlTNmp3MWo4Ijp7ImRpc2N1c3Np
b25JZCI6IkgwTGNNOVhVV1dtUzB3VDAiLCJzdWIiOiJnaDo1MT
ExMjYxOCIsInRleHQiOiI3LT44IiwiY3JlYXRlZCI6MTU5NTUw
MTAwNzM4M30sIkRKVUhRYmZnMFZMMzh6ZjkiOnsiZGlzY3Vzc2
lvbklkIjoiZzZaRFNCMXh0ZjVRVEMxZyIsInN1YiI6ImdoOjUx
MTEyNjE4IiwidGV4dCI6IlRpbWVzdGFtcCBjaGVjaz8iLCJjcm
VhdGVkIjoxNTk1NTAxMDMxMjg3fSwiWDdVZFVHaHR1QThUZk96
ciI6eyJkaXNjdXNzaW9uSWQiOiJmNHRIOHoxRzEyYWZ0TzB4Ii
wic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ijoib3IgTVQgU29s
aWRpZmllcj8iLCJjcmVhdGVkIjoxNTk1NTAxMDU2NDI0fSwiWm
ZJQms3dVYwN3lYRmh5ZCI6eyJkaXNjdXNzaW9uSWQiOiJKNXJW
bTI0VW9JZmRBY0plIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZX
h0IjoiV2h5IERlbGV0ZSBpbiBNZXNzYWdlIEluYm94PyIsImNy
ZWF0ZWQiOjE1OTU1MDEyMDY0NjB9LCI4a2Nhenh5OWpMNzFXVU
RhIjp7ImRpc2N1c3Npb25JZCI6IkNXM1U0OEtXWkVaZDNOM1Ui
LCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJhZGQgXCJERU
xFVEUgTWVzc2FnZSBJbmJveFwiIiwiY3JlYXRlZCI6MTU5NTUw
MTM4NDM2Nn0sIlFBODhKV1dVRklsbVRxMUgiOnsiZGlzY3Vzc2
lvbklkIjoiQ1czVTQ4S1daRVpkM04zVSIsInN1YiI6ImdoOjUx
MTEyNjE4IiwidGV4dCI6Ik9uY2UgYSBtZXNzYWdlIGlzIGRlbG
V0ZWQgZnJvbSBJbmJveCwgZ29zc2lwIG1pZ2h0IHB1dCBpdCB0
aGVyZSB5ZXQgYW5vdGhlciB0aW1lID8iLCJjcmVhdGVkIjoxNT
k1NTAxNDM2MDM2fSwiVlNXSlF6WXd6NzV4VmRoQSI6eyJkaXNj
dXNzaW9uSWQiOiJPYnZzTmpPMGlhbmN6bGllIiwic3ViIjoiZ2
g6NTExMTI2MTgiLCJ0ZXh0IjoiaW50cm9kdWNlIGxpbmsgdG8g
RGVmaW5pdGlvbiIsImNyZWF0ZWQiOjE1OTU1MDE0NzQ4NDl9LC
JXNUc3WGNmTkJ2a0hQYVZ5Ijp7ImRpc2N1c3Npb25JZCI6Im05
Sm1QeXBqVEdEa0o3TmciLCJzdWIiOiJnaDo1MTExMjYxOCIsIn
RleHQiOiJNaXNzaW5nIERFTEVURSBNZXNzYWdlIElOQk9YLCIs
ImNyZWF0ZWQiOjE1OTU1MDE1NDYwMzd9LCI0eWVBbjhUWVVSQn
NwekR4Ijp7ImRpc2N1c3Npb25JZCI6Im05Sm1QeXBqVEdEa0o3
TmciLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJBbmQgUk
VBRCIsImNyZWF0ZWQiOjE1OTU1MDE2NjE2MjN9LCJ1M1dzVjJ0
aURkQThuWU5FIjp7ImRpc2N1c3Npb25JZCI6Imp3QTFPeUo3dW
dWbWV6NHkiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJX
cm9uZyBEQiBvcGVyYXRpb247IFJFQUQvREVMRVRFIE1lc3NhZ2
UgSW5ib3giLCJjcmVhdGVkIjoxNTk1NTAxNzI5NjcwfSwiMkFi
T2FtU0c3OTdXQ0NybSI6eyJkaXNjdXNzaW9uSWQiOiJiNGEza0
l5WmxaUk9kVktGIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0
IjoiYWRkIHRoZXNlIGFjdGlvbiB0byBmaWd1cmUiLCJjcmVhdG
VkIjoxNTk1NTAxODIxNTYwfSwiTEtuR0FZbjJMNkFBUUZZRiI6
eyJkaXNjdXNzaW9uSWQiOiJmQWtLa1Z2U3VTUWxwclNnIiwic3
ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoieW91IG1lYW4gZHJv
cHBpbmcgdGhlIG5vZGU/IiwiY3JlYXRlZCI6MTU5NTUwMjAwMj
k2MH0sImFyT1RPNHhMVUNNSmdJUlciOnsiZGlzY3Vzc2lvbklk
IjoiNlNFQk1qZlpyZUNWSmFxZCIsInN1YiI6ImdoOjUxMTEyNj
E4IiwidGV4dCI6IkFkZCBGaWd1cmUiLCJjcmVhdGVkIjoxNTk1
NTAyMDIyNTUwfSwiMWFWaUNCck1DRFlDRW91ZiI6eyJkaXNjdX
NzaW9uSWQiOiJHMU93WnVCM2J0eDVyZnFWIiwic3ViIjoiZ2g6
NTExMTI2MTgiLCJ0ZXh0IjoiQWRkIEZpZ3VyZSIsImNyZWF0ZW
QiOjE1OTU1MDIwNTAwNDl9LCIxeVJ4OGVXOWZ5SHpOd2xjIjp7
ImRpc2N1c3Npb25JZCI6InRGSUt1aTl5MGY1ckVydlgiLCJzdW
IiOiJnaDo1MTExMjYxOCIsInRleHQiOiJBbGwgdGhpcyBjb21l
IGFmdGVyIHRoZSBNYWluIE1lc3NhZ2UgUHJvYyBEaWFnLiBUaG
lzIHNob3VsZCBiZSBzYWlkIGV4cGxpY3RseSIsImNyZWF0ZWQi
OjE1OTU1MDIyODYxMjh9LCJaNU1lYTUzaktYUDBHOHloIjp7Im
Rpc2N1c3Npb25JZCI6ImM2RDlWNVU0VGJFeDU2TXYiLCJzdWIi
OiJnaDo1MTExMjYxOCIsInRleHQiOiJOb3QgY2xlYXIgd2hhdC
BhbiBFcG9jaCBpcyIsImNyZWF0ZWQiOjE1OTU1MDIzOTQ1MjR9
LCJEbXJab2JNcnlROHpvdHp2Ijp7ImRpc2N1c3Npb25JZCI6Ik
FXajRUQ2JZdzRJNUhOWjEiLCJzdWIiOiJnaDo1MTExMjYxOCIs
InRleHQiOiJNaXNzaW5nIHRoZSBpbmZvcm1hdGlvbiB3aGVuIG
EgdHggdHVybnMgaW50byBlbGlnaWJsZSIsImNyZWF0ZWQiOjE1
OTU1MDI1ODU5MTR9LCJMbDNVamswd25heVpOT0MwIjp7ImRpc2
N1c3Npb25JZCI6IkVabERwUFJONGU2SGdXazkiLCJzdWIiOiJn
aDo1MTExMjYxOCIsInRleHQiOiJpbiBnZW5lcmFsIHRoZXJlIG
1pZ2h0IGJlIG1vcmUgdGhhbiAxIGNvbmZsaWN0aW5nIHR4Iiwi
Y3JlYXRlZCI6MTU5NTUwMjYzMzQ1M319LCJoaXN0b3J5IjpbLT
EwMzkzMTc0NSwxOTczMTgxMDYzLC0xNTgxOTUxODExLC02NDQy
MDI4MjgsLTE3NTI0NzY3Nyw4OTAzNTYzNDksLTY3NjY0NTIxOV
19
-->