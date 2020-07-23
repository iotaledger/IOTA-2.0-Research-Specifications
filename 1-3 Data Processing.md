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
JvIn19LCJjb21tZW50cyI6eyIwT2MyWWZhdWl4djhTQ3JQIjp7
ImRpc2N1c3Npb25JZCI6InVacWxSVnJTdWJIZjFjMDgiLCJzdW
IiOiJnaDo1MTExMjYxOCIsInRleHQiOiJ0aGUgcG9ydCBmb3Ig
YXV0b3BlZXJpbmcgcHJvdG9jb2wvcmVxdWVzdHM/IERvbiB0IH
VuZGVyc3RhbmQgd2hhdCB0aGUgZGVjaXNpb24gb24gIHdobyB0
byBjb25uZWN0IGhhcyB0byB0byB3aXRoIHRoZSBwb3J0LiIsIm
NyZWF0ZWQiOjE1OTU0MjA5Nzc1NTR9LCIzY0FFVzJmcHR0VUZx
bzBOIjp7ImRpc2N1c3Npb25JZCI6InVacWxSVnJTdWJIZjFjMD
giLCJzdWIiOiJnaDo2ODI1MDM1MCIsInRleHQiOiJJIHRyaWVk
IHRvIGdpdmUgYSBiZXR0ZXIgd29yZGluZywgdGhlIG9sZCBvbm
Ugd2FzIGF3ZnVsLiIsImNyZWF0ZWQiOjE1OTU0NDQxMTExNDJ9
LCJ1MldQdjBOWk9UNGpST2NoIjp7ImRpc2N1c3Npb25JZCI6In
VacWxSVnJTdWJIZjFjMDgiLCJzdWIiOiJnaDo1MTExMjYxOCIs
InRleHQiOiJzbyBpdHMgdGhlIHNhbWUgcG9ydCBmb3Igc2VuZG
luZyBhbmQgcmVxdWVzdGluZy4gSWYgeWVzIHBlcmhhcHMganVz
dCBjYWxsIGlzdCBBdXRvcGVlcmluZyBQb3J0IiwiY3JlYXRlZC
I6MTU5NTUwMDU4NjEyMn0sImg2TnVCREk0cE5uNkpqREMiOnsi
ZGlzY3Vzc2lvbklkIjoidUhwSzRqREZkbWdRVVhReCIsInN1Yi
I6ImdoOjUxMTEyNjE4IiwidGV4dCI6ImRlZmluZSBzbmFwc2hv
dCBzb21ld2hlcmUiLCJjcmVhdGVkIjoxNTk1NTAwNzAyOTU1fS
wiaVQ2VU80RVV0cDR1cGFnVyI6eyJkaXNjdXNzaW9uSWQiOiJz
N1BuQmQ0aVpvOFByaEhTIiwic3ViIjoiZ2g6NTExMTI2MTgiLC
J0ZXh0IjoianVzdCBcIk5vZGUgRGF0YWJhc2VcIj8iLCJjcmVh
dGVkIjoxNTk1NTAwODEwNTM1fSwiVFFIbHowV1A3VlpPZTJwSy
I6eyJkaXNjdXNzaW9uSWQiOiJIMExjTTlYVVdXbVMwd1QwIiwi
c3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiVGhlIE1haW4gTW
Vzc2FnZSBwcm9jZXNzb3IgaXMgZGl2aWRlZCBpbnRvIDcgc3Vi
LXByb2Nlc3NlczsgY292ZXJpbmcgYWxsIGFjdGlvbnMgYSBub2
RlIGhhcyB0byBwZXJmb3JtIGluIG9yZGVyIHRvIHNlbmQgYSBt
ZXNzYWdlID8iLCJjcmVhdGVkIjoxNTk1NTAwOTc5MTQyfSwiZE
ZKTG5ndHJpUzZqdzFqOCI6eyJkaXNjdXNzaW9uSWQiOiJIMExj
TTlYVVdXbVMwd1QwIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZX
h0IjoiNy0+OCIsImNyZWF0ZWQiOjE1OTU1MDEwMDczODN9LCJE
SlVIUWJmZzBWTDM4emY5Ijp7ImRpc2N1c3Npb25JZCI6Imc2Wk
RTQjF4dGY1UVRDMWciLCJzdWIiOiJnaDo1MTExMjYxOCIsInRl
eHQiOiJUaW1lc3RhbXAgY2hlY2s/IiwiY3JlYXRlZCI6MTU5NT
UwMTAzMTI4N30sIlg3VWRVR2h0dUE4VGZPenIiOnsiZGlzY3Vz
c2lvbklkIjoiZjR0SDh6MUcxMmFmdE8weCIsInN1YiI6ImdoOj
UxMTEyNjE4IiwidGV4dCI6Im9yIE1UIFNvbGlkaWZpZXI/Iiwi
Y3JlYXRlZCI6MTU5NTUwMTA1NjQyNH0sIlpmSUJrN3VWMDd5WE
ZoeWQiOnsiZGlzY3Vzc2lvbklkIjoiSjVyVm0yNFVvSWZkQWNK
ZSIsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6IldoeSBEZW
xldGUgaW4gTWVzc2FnZSBJbmJveD8iLCJjcmVhdGVkIjoxNTk1
NTAxMjA2NDYwfSwiOGtjYXp4eTlqTDcxV1VEYSI6eyJkaXNjdX
NzaW9uSWQiOiJDVzNVNDhLV1pFWmQzTjNVIiwic3ViIjoiZ2g6
NTExMTI2MTgiLCJ0ZXh0IjoiYWRkIFwiREVMRVRFIE1lc3NhZ2
UgSW5ib3hcIiIsImNyZWF0ZWQiOjE1OTU1MDEzODQzNjZ9LCJR
QTg4SldXVUZJbG1UcTFIIjp7ImRpc2N1c3Npb25JZCI6IkNXM1
U0OEtXWkVaZDNOM1UiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRl
eHQiOiJPbmNlIGEgbWVzc2FnZSBpcyBkZWxldGVkIGZyb20gSW
5ib3gsIGdvc3NpcCBtaWdodCBwdXQgaXQgdGhlcmUgeWV0IGFu
b3RoZXIgdGltZSA/IiwiY3JlYXRlZCI6MTU5NTUwMTQzNjAzNn
0sIlZTV0pRell3ejc1eFZkaEEiOnsiZGlzY3Vzc2lvbklkIjoi
T2J2c05qTzBpYW5jemxpZSIsInN1YiI6ImdoOjUxMTEyNjE4Ii
widGV4dCI6ImludHJvZHVjZSBsaW5rIHRvIERlZmluaXRpb24i
LCJjcmVhdGVkIjoxNTk1NTAxNDc0ODQ5fSwiVzVHN1hjZk5Cdm
tIUGFWeSI6eyJkaXNjdXNzaW9uSWQiOiJtOUptUHlwalRHRGtK
N05nIiwic3ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiTWlzc2
luZyBERUxFVEUgTWVzc2FnZSBJTkJPWCwiLCJjcmVhdGVkIjox
NTk1NTAxNTQ2MDM3fSwiNHllQW44VFlVUkJzcHpEeCI6eyJkaX
NjdXNzaW9uSWQiOiJtOUptUHlwalRHRGtKN05nIiwic3ViIjoi
Z2g6NTExMTI2MTgiLCJ0ZXh0IjoiQW5kIFJFQUQiLCJjcmVhdG
VkIjoxNTk1NTAxNjYxNjIzfSwidTNXc1YydGlEZEE4bllORSI6
eyJkaXNjdXNzaW9uSWQiOiJqd0ExT3lKN3VnVm1lejR5Iiwic3
ViIjoiZ2g6NTExMTI2MTgiLCJ0ZXh0IjoiV3JvbmcgREIgb3Bl
cmF0aW9uOyBSRUFEL0RFTEVURSBNZXNzYWdlIEluYm94IiwiY3
JlYXRlZCI6MTU5NTUwMTcyOTY3MH0sIjJBYk9hbVNHNzk3V0ND
cm0iOnsiZGlzY3Vzc2lvbklkIjoiYjRhM2tJeVpsWlJPZFZLRi
IsInN1YiI6ImdoOjUxMTEyNjE4IiwidGV4dCI6ImFkZCB0aGVz
ZSBhY3Rpb24gdG8gZmlndXJlIiwiY3JlYXRlZCI6MTU5NTUwMT
gyMTU2MH0sIkxLbkdBWW4yTDZBQVFGWUYiOnsiZGlzY3Vzc2lv
bklkIjoiZkFrS2tWdlN1U1FscHJTZyIsInN1YiI6ImdoOjUxMT
EyNjE4IiwidGV4dCI6InlvdSBtZWFuIGRyb3BwaW5nIHRoZSBu
b2RlPyIsImNyZWF0ZWQiOjE1OTU1MDIwMDI5NjB9LCJhck9UTz
R4TFVDTUpnSVJXIjp7ImRpc2N1c3Npb25JZCI6IjZTRUJNamZa
cmVDVkphcWQiLCJzdWIiOiJnaDo1MTExMjYxOCIsInRleHQiOi
JBZGQgRmlndXJlIiwiY3JlYXRlZCI6MTU5NTUwMjAyMjU1MH0s
IjFhVmlDQnJNQ0RZQ0VvdWYiOnsiZGlzY3Vzc2lvbklkIjoiRz
FPd1p1QjNidHg1cmZxViIsInN1YiI6ImdoOjUxMTEyNjE4Iiwi
dGV4dCI6IkFkZCBGaWd1cmUiLCJjcmVhdGVkIjoxNTk1NTAyMD
UwMDQ5fSwiMXlSeDhlVzlmeUh6TndsYyI6eyJkaXNjdXNzaW9u
SWQiOiJ0RklLdWk5eTBmNXJFcnZYIiwic3ViIjoiZ2g6NTExMT
I2MTgiLCJ0ZXh0IjoiQWxsIHRoaXMgY29tZSBhZnRlciB0aGUg
TWFpbiBNZXNzYWdlIFByb2MgRGlhZy4gVGhpcyBzaG91bGQgYm
Ugc2FpZCBleHBsaWN0bHkiLCJjcmVhdGVkIjoxNTk1NTAyMjg2
MTI4fX0sImhpc3RvcnkiOlsxNjIxODMxMzQ3LDE5NzMxODEwNj
MsLTE1ODE5NTE4MTEsLTY0NDIwMjgyOCwtMTc1MjQ3Njc3LDg5
MDM1NjM0OSwtNjc2NjQ1MjE5XX0=
-->