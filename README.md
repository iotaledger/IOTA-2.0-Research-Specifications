# Coordicide-Specifications For Iota 2.0

These specifications are not stable


  
-   [Glossary of terms](https://docs.google.com/document/d/1Ak8NT9e9NFQIrXahYmlgj_FLH7mMT5NR4rlTwczfQSE/edit#heading=h.h27luwpmebto)
    
-   [Diagram summarizing the protocol](https://app.diagrams.net/#G1DS5lUas9URTYwspkBl5nlp80R2opE5fC)
    

## Introduction

To orientate the reader, we provide a brief summary of the Iota 2.0 protocol. The network will be maintained via the Networking layer which consists of two basic modules: the peer discovery module which provides a list of nodes actively using the network, and the neighbor selection (aka autopeering) which actually picks links. The Networking layer also manages the gossiping which is done by flooding.

  

The communication layer concerns the information communicated through the network layer. Objects called messages will be exchanged between nodes. The rate control and congestion control modules control indicate exactly how many messages are sent and when in order to prevent the network from being overloaded. Messages will be stored in the message tangle which must be managed in a particular way. The processing specification describes how messages must be processed in order to meet the demands of the other components.

  

On top of the communication layer is the application layer. There are several core applications which must be run by all nodes. The most important application is the Value Transfer Application which maintains the ledger state and the mana held by each node. Providing sybil protection, mana is an essential part of the protocol and is used by numerous other modules.

  

Several core applications provide consensus and regulate timestamps in the message tangle and conflicts in the value tangle (a component of the value transfer application). FPC or Fast Probabilistic Consensus is a binary voting protocol which produces consensus on a bit. The “implementing FPC” specification outlines how this binary voting protocol is used to vote on actual objects. The FPC protocol relies on a DRNG, aka a distributed random number generator. Lastly, the resynchronisation application detects any FPC failures.

## Overview of files

**1. Structure**

-   **A.** Data Models
    
-   **B.** Communication Specifications
    
-   **C.** Payloads and Layers

**2. Network Layer**

-  **A.**  Peer DiscoveryCommunication Layer
Communication Layer

- **B.**  Data processing by nodes

-  **C.** Message Tangle
    
-   **D** Data processing by nodes

**3. Communication Layer**

- **A.**   Message Tangle
    
- **B.**  Rate control
    
-   **C.** Congestion Control
    

**4. Value Transfer Application**

-   **A.** Value Tangle
    
- **B.**  UTXO and Ledger Calculations
    
-   **C.** Mana
    
    **5. Core Consensus Applications**

-   **A.** FPC
   
- **B.**  Implementing FPC

-   **C.** DRNG

-   Resynchronization
    

<!--stackedit_data:
eyJoaXN0b3J5IjpbLTI4MzkzMjIxNywtMTM5ODUwMzQ1NiwtMT
A5MDA2OTQ2OSwxMzQzOTE0MDYwLC05MDkxOTEzNTYsLTE5MDM3
NjU2NTRdfQ==
-->