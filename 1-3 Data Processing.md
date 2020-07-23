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
* **Message inbox:** A data set where non-duplicated messages will stay until processed by the node and added to the Tangle. 
* **Solidification Buffer:** A data set where messages that were not able to quick-solidify will be kept until the missing messages arrive.
* **Message Tangle:** The main data set where all the non-snapshotted messages are kept. 
* **Rate Manager Outbox:** A data set where messages that were processed are kept until they are gossiped further. 

The following other data sets will be used in the processes:
* **Node List:** The list of nodes known by the current Node. 
* **Nodes Informations Database:** A database of quantities related to the nodes that are used for the protocol, such as "Mana Value", "Effective Mana", "Recent transactions arrivals", etc. 
* **Ledger State:** A list with the current balance on each address and node. 


# Main Message Processing Diagram 

The Main Message processor constitutes of 7 processes that constitutes of all actions the node do with a message from the moment it is received until it is included on its Tangle and further gossiped. The 8 processes are: "Duplicate Detector, "Node Signature Validator", "Timestamp Opinion and Filter", "Proof of Work Check", "Solidifier", "Rate Manager" and "Gossip Scheduler".

Ignoring the possible data sets and ports used, the processes are ordered as:

![](https://i.imgur.com/xFjNlFd.png)


1. **Duplicate Detector**
The Duplicate detector is triggered each time a message arrives in the gossip port. It will look if there if the exact same message has already arrived before, being either on the Message Tangle or in the Message Inbox. The message will only be added to the Message Inbox in  case it is not found in both data sets.
![](https://i.imgur.com/5Ke3jId.png)

2. **Node Signature Validator**
The Node Signature Validator will timely get messages from the Message Inbox and check in its signature is valid. Messages that fail this verification are deleted from the Message Inbox.
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
Nn19LCJjb21tZW50cyI6eyIwT2MyWWZhdWl4djhTQ3JQIjp7Im
Rpc2N1c3Npb25JZCI6InVacWxSVnJTdWJIZjFjMDgiLCJzdWIi
OiJnaDo1MTExMjYxOCIsInRleHQiOiJ0aGUgcG9ydCBmb3IgYX
V0b3BlZXJpbmcgcHJvdG9jb2wvcmVxdWVzdHM/IERvbiB0IHVu
ZGVyc3RhbmQgd2hhdCB0aGUgZGVjaXNpb24gb24gIHdobyB0by
Bjb25uZWN0IGhhcyB0byB0byB3aXRoIHRoZSBwb3J0LiIsImNy
ZWF0ZWQiOjE1OTU0MjA5Nzc1NTR9LCIzY0FFVzJmcHR0VUZxbz
BOIjp7ImRpc2N1c3Npb25JZCI6InVacWxSVnJTdWJIZjFjMDgi
LCJzdWIiOiJnaDo2ODI1MDM1MCIsInRleHQiOiJJIHRyaWVkIH
RvIGdpdmUgYSBiZXR0ZXIgd29yZGluZywgdGhlIG9sZCBvbmUg
d2FzIGF3ZnVsLiIsImNyZWF0ZWQiOjE1OTU0NDQxMTExNDJ9LC
J1MldQdjBOWk9UNGpST2NoIjp7ImRpc2N1c3Npb25JZCI6InVa
cWxSVnJTdWJIZjFjMDgiLCJzdWIiOiJnaDo1MTExMjYxOCIsIn
RleHQiOiJzbyBpdHMgdGhlIHNhbWUgcG9ydCBmb3Igc2VuZGlu
ZyBhbmQgcmVxdWVzdGluZy4gSWYgeWVzIHBlcmhhcHMganVzdC
BjYWxsIGlzdCBBdXRvcGVlcmluZyBQb3J0IiwiY3JlYXRlZCI6
MTU5NTUwMDU4NjEyMn19LCJoaXN0b3J5IjpbLTEyNDEwNTIyNj
EsLTY0NDIwMjgyOCwtMTc1MjQ3Njc3LDg5MDM1NjM0OSwtNjc2
NjQ1MjE5XX0=
-->