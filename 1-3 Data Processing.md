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
bmJvIn19LCJjb21tZW50cyI6eyIwT2MyWWZhdWl4djhTQ3JQIj
p7ImRpc2N1c3Npb25JZCI6InVacWxSVnJTdWJIZjFjMDgiLCJz
dWIiOiJnaDo1MTExMjYxOCIsInRleHQiOiJ0aGUgcG9ydCBmb3
IgYXV0b3BlZXJpbmcgcHJvdG9jb2wvcmVxdWVzdHM/IERvbiB0
IHVuZGVyc3RhbmQgd2hhdCB0aGUgZGVjaXNpb24gb24gIHdoby
B0byBjb25uZWN0IGhhcyB0byB0byB3aXRoIHRoZSBwb3J0LiIs
ImNyZWF0ZWQiOjE1OTU0MjA5Nzc1NTR9LCIzY0FFVzJmcHR0VU
ZxbzBOIjp7ImRpc2N1c3Npb25JZCI6InVacWxSVnJTdWJIZjFj
MDgiLCJzdWIiOiJnaDo2ODI1MDM1MCIsInRleHQiOiJJIHRyaW
VkIHRvIGdpdmUgYSBiZXR0ZXIgd29yZGluZywgdGhlIG9sZCBv
bmUgd2FzIGF3ZnVsLiIsImNyZWF0ZWQiOjE1OTU0NDQxMTExND
J9LCJ1MldQdjBOWk9UNGpST2NoIjp7ImRpc2N1c3Npb25JZCI6
InVacWxSVnJTdWJIZjFjMDgiLCJzdWIiOiJnaDo1MTExMjYxOC
IsInRleHQiOiJzbyBpdHMgdGhlIHNhbWUgcG9ydCBmb3Igc2Vu
ZGluZyBhbmQgcmVxdWVzdGluZy4gSWYgeWVzIHBlcmhhcHMgan
VzdCBjYWxsIGlzdCBBdXRvcGVlcmluZyBQb3J0IiwiY3JlYXRl
ZCI6MTU5NTUwMDU4NjEyMn0sImg2TnVCREk0cE5uNkpqREMiOn
siZGlzY3Vzc2lvbklkIjoidUhwSzRqREZkbWdRVVhReCIsInN1
YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6ImRlZmluZSBzbmFwc2
hvdCBzb21ld2hlcmUiLCJjcmVhdGVkIjoxNTk1NTAwNzAyOTU1
fSwiaVQ2VU80RVV0cDR1cGFnVyI6eyJkaXNjdXNzaW9uSWQiOi
JzN1BuQmQ0aVpvOFByaEhTIiwic3ViIjoiZ2g6NTExMTI2MTgi
LCJ0ZXh0IjoianVzdCBcIk5vZGUgRGF0YWJhc2VcIj8iLCJjcm
VhdGVkIjoxNTk1NTAwODEwNTM1fSwiVFFIbHowV1A3VlpPZTJw
SyI6eyJkaXNjdXNzaW9uSWQiOiJIMExjTTlYVVdXbVMwd1QwIi
wic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiVGhlIE1haW4g
TWVzc2FnZSBwcm9jZXNzb3IgaXMgZGl2aWRlZCBpbnRvIDcgc3
ViLXByb2Nlc3NlczsgY292ZXJpbmcgYWxsIGFjdGlvbnMgYSBu
b2RlIGhhcyB0byBwZXJmb3JtIGluIG9yZGVyIHRvIHNlbmQgYS
BtZXNzYWdlID8iLCJjcmVhdGVkIjoxNTk1NTAwOTc5MTQyfSwi
ZEZKTG5ndHJpUzZqdzFqOCI6eyJkaXNjdXNzaW9uSWQiOiJIME
xjTTlYVVdXbVMwd1QwIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0
ZXh0IjoiNy0+OCIsImNyZWF0ZWQiOjE1OTU1MDEwMDczODN9LC
JESlVIUWJmZzBWTDM4emY5Ijp7ImRpc2N1c3Npb25JZCI6Imc2
WkRTQjF4dGY1UVRDMWciLCJzdWIiOiJnaDo1MTExMjYxOCIsIn
RleHQiOiJUaW1lc3RhbXAgY2hlY2s/IiwiY3JlYXRlZCI6MTU5
NTUwMTAzMTI4N30sIlg3VWRVR2h0dUE4VGZPenIiOnsiZGlzY3
Vzc2lvbklkIjoiZjR0SDh6MUcxMmFmdE8weCIsInN1YiI6Imdo
OjUxMTEyNjE4IiwidGV4dCI6Im9yIE1UIFNvbGlkaWZpZXI/Ii
wiY3JlYXRlZCI6MTU5NTUwMTA1NjQyNH0sIlpmSUJrN3VWMDd5
WEZoeWQiOnsiZGlzY3Vzc2lvbklkIjoiSjVyVm0yNFVvSWZkQW
NKZSIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IldoeSBE
ZWxldGUgaW4gTWVzc2FnZSBJbmJveD8iLCJjcmVhdGVkIjoxNT
k1NTAxMjA2NDYwfSwiOGtjYXp4eTlqTDcxV1VEYSI6eyJkaXNj
dXNzaW9uSWQiOiJDVzNVNDhLV1pFWmQzTjNVIiwic3ViIjoiZ2
g6NTExMTI2MTgiLCJ0ZXh0IjoiYWRkIFwiREVMRVRFIE1lc3Nh
Z2UgSW5ib3hcIiIsImNyZWF0ZWQiOjE1OTU1MDEzODQzNjZ9LC
JRQTg4SldXVUZJbG1UcTFIIjp7ImRpc2N1c3Npb25JZCI6IkNX
M1U0OEtXWkVaZDNOM1UiLCJzdWIiOiJnaDo1MTExMjYxOCIsIn
RleHQiOiJPbmNlIGEgbWVzc2FnZSBpcyBkZWxldGVkIGZyb20g
SW5ib3gsIGdvc3NpcCBtaWdodCBwdXQgaXQgdGhlcmUgeWV0IG
Fub3RoZXIgdGltZSA/IiwiY3JlYXRlZCI6MTU5NTUwMTQzNjAz
Nn19LCJoaXN0b3J5IjpbMTA1MDQyMDUyMiwtMTU4MTk1MTgxMS
wtNjQ0MjAyODI4LC0xNzUyNDc2NzcsODkwMzU2MzQ5LC02NzY2
NDUyMTldfQ==
-->