# Table of Contents

**1. Structure**

-   **1.1**   Data Structures
    

**2. Network** 
-  **2.1**  **Peer Discovery**
	- **2.1.1** Summary
	- **2.1.2** Motivation
	- **2.1.3** Terminology
	- **2.1.4** Detailed design
		- **2.1.4.1** Node identities
		- **2.1.4.2** Verification
		- **2.1.4.3** Removal
		- **2.1.4.4** Discovery
		- **2.1.4.5** Messages
	- **2.1.5** Drawbacks
	- **2.1.6** Rationale and alternatives
	- **2.1.7** Unresolved questions

-  **2.2** **Neighbor Selection**
	- **2.2.1** Summary
	- **2.2.2** Motivation
	- **2.2.3** Terminology
	- **2.2.5** Detailed design 
		- **2.2.5.1** Node identities
		- **2.2.5.2** Salt generation
		- **2.2.5.3** Selection
		- **2.2.5.4** Neighbor Removal
		- **2.2.5.5** Mana rank
		- **2.2.5.6** Messages
	- **2.2.6** Drawbacks
	- **2.2.7** Rationale and alternatives
	- **2.2.8** Unresolved questions
    
**3. Communication Layer** 

- **3.1** **Data Processing**
	- **3.1.1** Terminology 
	- **3.1.2** PROCESS Anatomy
	- **3.1.3** List of Ports and Data Collections
	- **3.1.4** Main Tangle Message Processing Diagram 
	- **3.1.5** Value Message Processing Diagram 
	- **3.1.6** Independent Processes

- **3.2**   **Message Tangle Protocol**
	- **3.2.1** Summary
	- **3.2.2** Preliminaries
		- **3.2.2.1** Parameters, lists, and functions
		- **3.2.2.2** How messages are stored
	- **3.2.3** Main Components
		- **3.2.3.1** Timestamps
		- **3.2.3.2** Below Max Depth Check 
		- **3.2.3.3** Tip selection
		- **3.2.3.4** Finality
		- **3.2.3.5** Snapshotting
		- **3.2.3.6** Reattachments

- **3.3** **Rate Control**
	- **3.3.1** Summary
		- **3.3.1.1** Current implementation
		- **3.3.1.2** Proposal
		- **3.3.1.3** Prerequisites
	- **3.3.2** Adaptive Proof of Work
		- **3.3.2.1** Message generation
		- **3.3.2.2** Message verification
	- **3.3.3** Algorithm
		 - **3.3.3.1** Protocol variables
		 - **3.3.3.2** Node variables
		 - **3.3.3.3** Pseudocode
		 - **3.3.3.4** Data structures
	- **3.3.4** Attack vectors
		- **3.3.4.1** False positive messages
		- **3.3.4.2** Pre mining
	- **3.3.5** Alternative solutions


- **3.4** **Congestion Control**
    

**4. Value Transfer Application**

- **4.1** **Value Tangle Protocol**
	- **4.1.1** Summary
	- **4.1.2** Preliminaries
		- **4.1.2.1** Parameters, lists, and functions
		- **4.1.2.2** How value objects and transactions are stored
	- **4.1.3** Main Components
		- **4.1.3.1** Timestamps
		- **4.1.3.2** Indexed transactions and reattachments
		- **4.1.3.3** Solidification
		- **4.1.3.4** Conflict detection 
		- **4.1.3.5** Tip Selection
		- **4.1.3.6** Correction check
		- **4.1.3.7** Finality
		- **4.1.3.8** Snapshotting
		- **4.1.3.9** Remaining Problems
    
- **4.2**  **UTXO and Ledger Calculations**
	- **4.2.1** Summary
	- **4.2.2** Motivation
	- **4.2.3** Detailed design
		- **4.2.3.1** Output IDs
		- **4.2.3.2** Colored Balances
		- **4.2.3.3** Outputs
		- **4.2.3.4** OPCodes
		- **4.2.3.5** Conflict Detection
	- **4.2.4** Drawbacks
	- **4.2.5** Rationale and alternatives
	- **4.2.6** Unresolved questions
    
-  **4.3** **Mana**
	- **4.3.1** Summary
	- **4.3.2** Motivation
	- **4.3.3** Detailed design
		- **4.3.3.1** The Base Mana Vector
			- **4.3.3.1.1** Introduction
			- **4.3.3.1.2** Parameter Values
			- **4.3.3.1.3** Initialization
			- **4.3.3.1.4** Base Mana State Update
			- **4.3.3.1.5** Base Mana 1
			- **4.3.3.1.6** Effective Base Mana 1
			- **4.3.3.1.7** Base Mana 2
			- **4.3.3.1.8** Effective Base Mana 2
			- **4.3.3.1.9** Code
		- **4.3.3.2** Access Mana
		- **4.3.3.3** Consensus Mana
			- **4.3.3.3.1** dRNG
			- **4.3.3.3.2** FPC
			- **4.3.3.3.3** Auto Peering
    
   **5. Core Consensus Applications**

- **5.1** **FPC - Fast Probabilistic Consensus**
	- **5.1.1** Motivation
	- **5.1.2** Dependencies
	- **5.1.3** Remarks
	- **5.1.4** The core FPC
		- **5.1.4.1** Protocol variables
		- **5.1.4.2** Local variables
		- **5.1.4.3** Functions that are called
		- **5.1.4.4** Pseudocode 
		- **5.1.4.5** Message/transaction layout
	- **5.1.5** FPC on tangle
		- **5.1.5.1** Parallelity
		- **5.1.5.2** Consistency and Monotonicity
		- **5.1.5.3** Data layer
		- **5.1.5.4** Value layer
	- **5.1.6** Message compression of FPC
		- **5.1.6.1** Compression in query messages
		- **5.1.6.2** Gossiping
	- **5.1.7** Protocol monitoring
	- **5.1.8** Testing
		- **5.1.8.1** Edge cases
		- **5.1.8.2** Spamming
		- **5.1.8.3** Adversarial strategies
   
- **5.2**  **Implementing FPC**
	- **5.2.1** Summary
	- **5.2.2** Motivation
	- **5.2.3** Detailed design
		- **5.2.3.1** Parameters and lists
		- **5.2.3.2** How opinions on objects are stored
		- **5.2.3.3** Query Status
		- **5.2.3.4** Answer Status
	- **5.2.4** Rationale and Alternatives 

- **5.3** **Decentralized Random Number Generator**
	- **5.3.1** Introduction
		- **5.3.1.1** Other options: Threshold vs VDF
	- **5.3.2** Dependencies
	- **5.3.3** Outline of the decentralized random number generation
	- **5.3.4** Parameters 
	- **5.3.5** Committee selection
		- **5.3.5.1** Fixing mana perception
		- **5.3.5.2** Getting committee from mana perception
		- **5.3.5.3** Message exchange phase - DKG
		- **5.3.5.4** Committee selection failure 
		- **5.3.5.5** Double seats in the committee 
		- **5.3.5.6** Syncing of committee nodes
	- **5.3.6** Backup options
	- **5.3.7** Collective beacon
	- **5.3.8** Payload layout
		- **5.3.8.1** Application messages
		- **5.3.8.2** DRK generation
		- **5.3.8.3** Randomness revealing messages
	- **5.3.9** Committee failure and RN recoverability
	- **5.3.10** Parameters values
	- **5.3.11** Unresolved questions and future improvements
		- **5.3.11.1** Research questions

- **5.4** **Resynchronization**
	- **5.4.1** FPC and the probability of failure
	- **5.4.2** Realities 
		- **5.4.2.1** Mana associated with reality
		- **5.4.2.2** Query for the best reality 
	- **5.4.3** Resynchronisation protocol
		- **5.4.3.1** Variables and parameters 
	- **5.4.4** Functions
		- **5.4.4.1** Pseudocode
		- **5.4.4.2** Timescale and priority of resynch messages
		- **5.4.4.3** Values of the parameters
    - **5.4.5** Messages layout
	    - **5.4.5.1** Resynchronization query request
	    - **5.4.5.2** Resynchronization query answer