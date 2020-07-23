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
ImVuZCI6NjEzNCwidGV4dCI6IkVwb2NocyJ9fSwiY29tbWVudH
MiOnsiME9jMllmYXVpeHY4U0NyUCI6eyJkaXNjdXNzaW9uSWQi
OiJ1WnFsUlZyU3ViSGYxYzA4Iiwic3ViIjoiZ2g6NTExMTI2MT
giLCJ0ZXh0IjoidGhlIHBvcnQgZm9yIGF1dG9wZWVyaW5nIHBy
b3RvY29sL3JlcXVlc3RzPyBEb24gdCB1bmRlcnN0YW5kIHdoYX
QgdGhlIGRlY2lzaW9uIG9uICB3aG8gdG8gY29ubmVjdCBoYXMg
dG8gdG8gd2l0aCB0aGUgcG9ydC4iLCJjcmVhdGVkIjoxNTk1ND
IwOTc3NTU0fSwiM2NBRVcyZnB0dFVGcW8wTiI6eyJkaXNjdXNz
aW9uSWQiOiJ1WnFsUlZyU3ViSGYxYzA4Iiwic3ViIjoiZ2g6Nj
gyNTAzNTAiLCJ0ZXh0IjoiSSB0cmllZCB0byBnaXZlIGEgYmV0
dGVyIHdvcmRpbmcsIHRoZSBvbGQgb25lIHdhcyBhd2Z1bC4iLC
JjcmVhdGVkIjoxNTk1NDQ0MTExMTQyfSwidTJXUHYwTlpPVDRq
Uk9jaCI6eyJkaXNjdXNzaW9uSWQiOiJ1WnFsUlZyU3ViSGYxYz
A4Iiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0Ijoic28gaXRz
IHRoZSBzYW1lIHBvcnQgZm9yIHNlbmRpbmcgYW5kIHJlcXVlc3
RpbmcuIElmIHllcyBwZXJoYXBzIGp1c3QgY2FsbCBpc3QgQXV0
b3BlZXJpbmcgUG9ydCIsImNyZWF0ZWQiOjE1OTU1MDA1ODYxMj
J9LCJoNk51QkRJNHBObjZKakRDIjp7ImRpc2N1c3Npb25JZCI6
InVIcEs0akRGZG1nUVVYUXgiLCJzdWIiOiJnaDo1MTExMjYxOC
IsInRleHQiOiJkZWZpbmUgc25hcHNob3Qgc29tZXdoZXJlIiwi
Y3JlYXRlZCI6MTU5NTUwMDcwMjk1NX0sImlUNlVPNEVVdHA0dX
BhZ1ciOnsiZGlzY3Vzc2lvbklkIjoiczdQbkJkNGlabzhQcmhI
UyIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Imp1c3QgXC
JOb2RlIERhdGFiYXNlXCI/IiwiY3JlYXRlZCI6MTU5NTUwMDgx
MDUzNX0sIlRRSGx6MFdQN1ZaT2UycEsiOnsiZGlzY3Vzc2lvbk
lkIjoiSDBMY005WFVXV21TMHdUMCIsInN1YiI6ImdoOjUxMTEy
NjE4IiwidGV4dCI6IlRoZSBNYWluIE1lc3NhZ2UgcHJvY2Vzc2
9yIGlzIGRpdmlkZWQgaW50byA3IHN1Yi1wcm9jZXNzZXM7IGNv
dmVyaW5nIGFsbCBhY3Rpb25zIGEgbm9kZSBoYXMgdG8gcGVyZm
9ybSBpbiBvcmRlciB0byBzZW5kIGEgbWVzc2FnZSA/IiwiY3Jl
YXRlZCI6MTU5NTUwMDk3OTE0Mn0sImRGSkxuZ3RyaVM2ancxaj
giOnsiZGlzY3Vzc2lvbklkIjoiSDBMY005WFVXV21TMHdUMCIs
InN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IjctPjgiLCJjcm
VhdGVkIjoxNTk1NTAxMDA3MzgzfSwiREpVSFFiZmcwVkwzOHpm
OSI6eyJkaXNjdXNzaW9uSWQiOiJnNlpEU0IxeHRmNVFUQzFnIi
wic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiVGltZXN0YW1w
IGNoZWNrPyIsImNyZWF0ZWQiOjE1OTU1MDEwMzEyODd9LCJYN1
VkVUdodHVBOFRmT3pyIjp7ImRpc2N1c3Npb25JZCI6ImY0dEg4
ejFHMTJhZnRPMHgiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleH
QiOiJvciBNVCBTb2xpZGlmaWVyPyIsImNyZWF0ZWQiOjE1OTU1
MDEwNTY0MjR9LCJaZklCazd1VjA3eVhGaHlkIjp7ImRpc2N1c3
Npb25JZCI6Iko1clZtMjRVb0lmZEFjSmUiLCJzdWIiOiJnaDo1
MTExMjYxOCIsInRleHQiOiJXaHkgRGVsZXRlIGluIE1lc3NhZ2
UgSW5ib3g/IiwiY3JlYXRlZCI6MTU5NTUwMTIwNjQ2MH0sIjhr
Y2F6eHk5akw3MVdVRGEiOnsiZGlzY3Vzc2lvbklkIjoiQ1czVT
Q4S1daRVpkM04zVSIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4
dCI6ImFkZCBcIkRFTEVURSBNZXNzYWdlIEluYm94XCIiLCJjcm
VhdGVkIjoxNTk1NTAxMzg0MzY2fSwiUUE4OEpXV1VGSWxtVHEx
SCI6eyJkaXNjdXNzaW9uSWQiOiJDVzNVNDhLV1pFWmQzTjNVIi
wic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiT25jZSBhIG1l
c3NhZ2UgaXMgZGVsZXRlZCBmcm9tIEluYm94LCBnb3NzaXAgbW
lnaHQgcHV0IGl0IHRoZXJlIHlldCBhbm90aGVyIHRpbWUgPyIs
ImNyZWF0ZWQiOjE1OTU1MDE0MzYwMzZ9LCJWU1dKUXpZd3o3NX
hWZGhBIjp7ImRpc2N1c3Npb25JZCI6Ik9idnNOak8waWFuY3ps
aWUiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJpbnRyb2
R1Y2UgbGluayB0byBEZWZpbml0aW9uIiwiY3JlYXRlZCI6MTU5
NTUwMTQ3NDg0OX0sIlc1RzdYY2ZOQnZrSFBhVnkiOnsiZGlzY3
Vzc2lvbklkIjoibTlKbVB5cGpUR0RrSjdOZyIsInN1YiI6Imdo
OjUxMTEyNjE4IiwidGV4dCI6Ik1pc3NpbmcgREVMRVRFIE1lc3
NhZ2UgSU5CT1gsIiwiY3JlYXRlZCI6MTU5NTUwMTU0NjAzN30s
IjR5ZUFuOFRZVVJCc3B6RHgiOnsiZGlzY3Vzc2lvbklkIjoibT
lKbVB5cGpUR0RrSjdOZyIsInN1YiI6ImdoOjUxMTEyNjE4Iiwi
dGV4dCI6IkFuZCBSRUFEIiwiY3JlYXRlZCI6MTU5NTUwMTY2MT
YyM30sInUzV3NWMnRpRGRBOG5ZTkUiOnsiZGlzY3Vzc2lvbklk
IjoiandBMU95Sjd1Z1ZtZXo0eSIsInN1YiI6ImdoOjUxMTEyNj
E4IiwidGV4dCI6Ildyb25nIERCIG9wZXJhdGlvbjsgUkVBRC9E
RUxFVEUgTWVzc2FnZSBJbmJveCIsImNyZWF0ZWQiOjE1OTU1MD
E3Mjk2NzB9LCIyQWJPYW1TRzc5N1dDQ3JtIjp7ImRpc2N1c3Np
b25JZCI6ImI0YTNrSXlabFpST2RWS0YiLCJzdWIiOiJnaDo1MT
ExMjYxOCIsInRleHQiOiJhZGQgdGhlc2UgYWN0aW9uIHRvIGZp
Z3VyZSIsImNyZWF0ZWQiOjE1OTU1MDE4MjE1NjB9LCJMS25HQV
luMkw2QUFRRllGIjp7ImRpc2N1c3Npb25JZCI6ImZBa0trVnZT
dVNRbHByU2ciLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOi
J5b3UgbWVhbiBkcm9wcGluZyB0aGUgbm9kZT8iLCJjcmVhdGVk
IjoxNTk1NTAyMDAyOTYwfSwiYXJPVE80eExVQ01KZ0lSVyI6ey
JkaXNjdXNzaW9uSWQiOiI2U0VCTWpmWnJlQ1ZKYXFkIiwic3Vi
IjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiQWRkIEZpZ3VyZSIsIm
NyZWF0ZWQiOjE1OTU1MDIwMjI1NTB9LCIxYVZpQ0JyTUNEWUNF
b3VmIjp7ImRpc2N1c3Npb25JZCI6IkcxT3dadUIzYnR4NXJmcV
YiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJBZGQgRmln
dXJlIiwiY3JlYXRlZCI6MTU5NTUwMjA1MDA0OX0sIjF5Ung4ZV
c5ZnlIek53bGMiOnsiZGlzY3Vzc2lvbklkIjoidEZJS3VpOXkw
ZjVyRXJ2WCIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Ik
FsbCB0aGlzIGNvbWUgYWZ0ZXIgdGhlIE1haW4gTWVzc2FnZSBQ
cm9jIERpYWcuIFRoaXMgc2hvdWxkIGJlIHNhaWQgZXhwbGljdG
x5IiwiY3JlYXRlZCI6MTU5NTUwMjI4NjEyOH0sIlo1TWVhNTNq
S1hQMEc4eWgiOnsiZGlzY3Vzc2lvbklkIjoiYzZEOVY1VTRUYk
V4NTZNdiIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6Ik5v
dCBjbGVhciB3aGF0IGFuIEVwb2NoIGlzIiwiY3JlYXRlZCI6MT
U5NTUwMjM5NDUyNH19LCJoaXN0b3J5IjpbLTE5MDE3MDk3MDMs
MTk3MzE4MTA2MywtMTU4MTk1MTgxMSwtNjQ0MjAyODI4LC0xNz
UyNDc2NzcsODkwMzU2MzQ5LC02NzY2NDUyMTldfQ==
-->