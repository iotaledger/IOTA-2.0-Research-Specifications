# Specifications For Iota 2.0

These specifications are not stable

  

This document contains links to all specifications for all the components of all the components of the Iota 2.0 protocol informally known as coordicide. These specifications are currently in flux as the research department is still writing and revising them.

  

-   [Glossary of terms](https://docs.google.com/document/d/1Ak8NT9e9NFQIrXahYmlgj_FLH7mMT5NR4rlTwczfQSE/edit#heading=h.h27luwpmebto)
    
-   [Diagram summarizing the protocol](https://app.diagrams.net/#G1DS5lUas9URTYwspkBl5nlp80R2opE5fC)
    

## Introduction

To orientate the reader, we provide a brief summary of the Iota 2.0 protocol. The network will be maintained via the Networking layer which consists of two basic modules: the peer discovery module which provides a list of nodes actively using the network, and the neighbour selection (aka autopeering) which actually picks links. The Networking layer also manages the gossiping which is done by flooding.

  

The communication layer concerns the information communicated through the network layer. Objects called messages will be exchanged between nodes. The rate control and congestion control modules control indicate exactly how many messages are sent and when in order to prevent the network from being overloaded. Messages will be stored in the message tangle which must be managed in a particular way. The processing specification describes how messages must be processed in order to meet the demands of the other components.

  

On top of the communication layer is the application layer. There are several core applications which must be run by all nodes. The most important application is the Value Transfer Application which maintains the ledger state and the mana held by each node. Providing sybil protection, mana is an essential part of the protocol and is used by numerous other modules.

  

Several core applications provide consensus and regulate timestamps in the message tangle and conflicts in the value tangle (a component of the value transfer application). FPC or Fast Probabilistic Consensus is a binary voting protocol which produces consensus on a bit. The “implementing FPC” specification outlines how this binary voting protocol is used to vote on actual objects. The FPC protocol relies on a DRNG, aka a distributed random number generator. Lastly, the resynchronisation application detects any FPC failures.

## Specification links

Each specification is authored by a researcher and has been reviewed by an engineer.

Structure
-   Data Models
-   Communication Specifications
    
-   Payloads and Layers   Author: Darcy
    

Network Layer

-   Peer Discovery
    

-   Author: Angelo
    
-   Engineer:
    
-   [https://hackmd.io/lpa1Mz_ITNuWc1NQ8wuU5w](https://slack-redir.net/link?url=https%3A%2F%2Fhackmd.io%2Flpa1Mz_ITNuWc1NQ8wuU5w)
    

-   Neighbor Selection
    

-   Author: Angelo
    
-   Engineer:
    
-   [https://hackmd.io/j2MkN2K-SViAqe_b_6d98g](https://slack-redir.net/link?url=https%3A%2F%2Fhackmd.io%2Fj2MkN2K-SViAqe_b_6d98g)
    

Communication Layer

-   Data processing by nodes
    

-   Author: Darcy
    
-   Engineer:
    
-   [https://hackmd.io/@darcycamargo/Sy9AYrKjI](https://hackmd.io/@darcycamargo/Sy9AYrKjI)
    

-   Message Tangle
    

-   Author: Billy
    
-   Engineer: Broad
    
-   [https://hackmd.io/YfrUh4wqSua0Ou4-XHwYIA?both](https://slack-redir.net/link?url=https%3A%2F%2Fhackmd.io%2FYfrUh4wqSua0Ou4-XHwYIA%3Fboth)
    

-   Rate control
    

-   Author: Luigi
    
-   Engineer:
    
-   [https://hackmd.io/hYZfYt4eQZ6O_txGIEjKzw](https://slack-redir.net/link?url=https%3A%2F%2Fhackmd.io%2FhYZfYt4eQZ6O_txGIEjKzw)
    

-   Congestion Control
    

-   Author: Luigi
    
-   Engineer:
    
-   [https://hackmd.io/@MdtzMI7yTYmOxpysMspUuA/SyHpc6O6I](https://hackmd.io/@MdtzMI7yTYmOxpysMspUuA/SyHpc6O6I)
    

Value Transfer Application

-   Value Tangle
    

-   Author: Billy
    
-   Engineer:
    
-   [https://hackmd.io/KyYUG9hPQo6gziOD9AN1gA?both](https://slack-redir.net/link?url=https%3A%2F%2Fhackmd.io%2FKyYUG9hPQo6gziOD9AN1gA%3Fboth)
    

-   UTXO and Realities
    

-   Author: Hans
    
-   Engineer: Hans
    
-   [https://github.com/hmoog/protocol-rfcs/blob/master/text/0011-utxo-model/0011-utxo-model.md](https://slack-redir.net/link?url=https%3A%2F%2Fgithub.com%2Fhmoog%2Fprotocol-rfcs%2Fblob%2Fmaster%2Ftext%2F0011-utxo-model%2F0011-utxo-model.md)
    

-   Mana
    

-   Author: Olivia
    
-   Engineer: Gal
    
-   [https://hackmd.io/6cGfKtWaSnm1m4bWOROkWw](https://slack-redir.net/link?url=https%3A%2F%2Fhackmd.io%2F6cGfKtWaSnm1m4bWOROkWw)
    

Core Consensus Applications

-   FPC
    

-   Author: Sebastian
    
-   Engineer:
    
-   [https://hackmd.io/s/HkFbpbTrU](https://slack-redir.net/link?url=https%3A%2F%2Fhackmd.io%2Fs%2FHkFbpbTrU)
    

-   Implementing FPC
    

-   Author: Billy
    
-   Engineer: Brord
    
-   [https://hackmd.io/xBfQ04NkRi6IrwhEQm7aJQ](https://slack-redir.net/link?url=https%3A%2F%2Fhackmd.io%2FxBfQ04NkRi6IrwhEQm7aJQ)
    

-   DRNG
    

-   Author: Bart
    
-   Engineer:
    
-   [https://hackmd.io/uG4DE18UQFqxBgcOZ3_E9A](https://slack-redir.net/link?url=https%3A%2F%2Fhackmd.io%2FuG4DE18UQFqxBgcOZ3_E9A)
    

-   Resynchronization
    

-   Author: Bart
    
-   Engineer:
    
-   [https://hackmd.io/mWAfO7ckRbGWcaO7ksi27w](https://slack-redir.net/link?url=https%3A%2F%2Fhackmd.io%2FmWAfO7ckRbGWcaO7ksi27w)
<!--stackedit_data:
eyJoaXN0b3J5IjpbLTE0NTE4MDQ2NThdfQ==
-->