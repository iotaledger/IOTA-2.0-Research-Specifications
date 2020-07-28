+ Feature name: `Neighbor Selection`
+ Start date: 2020-07-05
+ RFC PR: [iotaledger/protocol-rfcs#0000](https://github.com/iotaledger/protocol-rfcs/pull/0000)


# Summary
This RFC defines the *Neighbor Selection* protocol, its logic and the different messages exchanged.

# Motivation
In order for the network to work efficiently and for the nodes to be kept up-to-date about the ledger state, nodes exchange information, such as messages and value transactions, with each other. Each node establishes a communication channel with a small subset of nodes (i.e., neighbors) via a process called `peering`. Such a process must be resilient against Eclipse attacks: if all of a node’s neighbors are controlled by an attacker, then the attacker has complete control over the node’s view of the Tangle. Moreover, to prevent/limitate sybil-based attacks, the neighbor selection protocol makes use of a scarce resource dubbed Mana: arbitrary nodes can be created, but it is is difficult to produce high mana nodes.

# Terminology
Throughout this RFC the terms `Node` and `Peer` are used interchangeably. 

# Dependencies
The neighbor selection protocol depends on:

+ Peer discovery: to get a list of the known and verified peers.
+ Mana: to make the selection partially based on Mana.
+ Communication layer: to send a `salt declaration` message.

# Detailed design 
The goal of the neighbor selection is to build a node's neighborhood (to be used by the gossip protocol) while preventing attackers from “tricking” other nodes into becoming neighbors. Neighbors are established when one node sends a peering-request message to another node, which in turn accepts or rejects the request with a peering-response message. 

To prevent attacks, the protocol makes the peering-request *verifiably random* such that attackers cannot create nodes to which the target node will send requests. At its core, the neighbor selection protocol uses both a screening process called *Mana rank* and a *distance function* that takes into account some randomness dubbed *private* and *public salt*. 
Nodes choose half of their neighbors themselves and let the other half be comprised of neighbors that choose them. The two distinct groups of neighbors are consequently called:
+ Chosen neighbors (outbound). The peers that the node proactively chooses from its list of neighbors.
+ Accepted neighbors (inbound). The peers that choose the node as their neighbor.


## Node identities
As for the *peer discovery* protocol, every node has a cryptographic identity, a key on the ed25519 elliptic curve. The `blake2b` hash of the public key of the peer serves as its identifier or `node ID`.

## Salt generation

Nodes need to have a public and private salt both defined as array bytes of size 20. Nodes should update both their public and private salt at fixed time intervals (e.g. 3 hours).
The public salt is used for outbound peering requests, while the private salt is used during inbound peering requests.

The public salt must satisfy the following requirements:

1. Future salts must be unguessable: Otherwise, can mine node ids which reduce the request distance. This offers protection for the requesting nodes.
2. Salts cannot be arbitrarily chosen: If an attacker can choose their salt, they can manufacture malicious requests for any node.

This RFC preposes to set the public salt using hash chains, while private salt can be randomly generated on the fly. New node will create a hash chain, and they make public the last element of their hash chain as their initial salt. Every future salt is the next element of the hash chain. Under this proposal, property 1 holds because cryptograhic hash functions are not reversible. 
Property 2 holds fairly well: an attacker can only choose one element of their hash chain. Indeed, an attacker can pick a number to be their 300th salt, hash it 300 times, and post that as their initial salt. However, an attacker can only do this for one round since hash functions have effectively random outputs. Thus an attacker is limited in their ability to choose their own salt.

First, a new node creates a hash chain of length 10,000. The last element of this hash chain is their initial salt. Nodes declare their initial salt in a message on the tangle using a payload type called `salt declaration`. In a salt declaration message, the declaring node includes

+ The declaring node ID (which can be different from the node ID issuing the message)
+ The initial salt
+ The timestamp (which should be close to the timestamp of its containing message)
+ Node signature

The salt declaration messages must be signed so that all “redeclerations” would be malicious.
The declaring node can prepare the message, and have some other node issue it into the network if the node does not have any neighbors yet. 

Nodes will keep track of these `salt declaration` messages to update the declared initial salt of their known peers list.

Assuming a salt update at time interval of 3 hours, after about 3 years, a node’s salt chain will run out. It can then set a new salt chain with a new initial salt declaration. The new salt declaration time should occur 30,000 hours after the last salt declaration time. Dishonest new salt declarations can be ignored.

### Hash chain

An example of hash-chain implementation is shown in the following Go code:

```
hashChain := make([][32]byte, 10000)
data := []byte("Secret seed")
for i := 0; i < 10000; i++ {
    hashChain[i] = blake2b.Sum256(data)
    copy(data[:], hashChain[i][:])
}
```

Note that such operation takes ~2ms to be computed on a modern laptop.

## Selection

The maximum number of neighbors depends on the gossip protocol. This RFC proposes to use a size of 8 equally divided into 4 chosen (outbound) and 4 accepted (inbound) neighbors.

In a nutshell, the operations involved during neighbor selection are listed in the following:

1.  Get an up-to-date list of verified and known peers from the peer discovery protocol. 
2.  Use [mana rank](#Mana_rank) to filter the previous list to obtain a list of potential peering partners.
3.  Use the distance function to choose/accept peering partners.

The distance between two nodes is measured through the distance function d, defined by:

d(nodeIdD, nodeID2, salt) = hash(nodeID1) XOR hash(nodeID2 || salt), where: 

+ `nodeID1` and `nodeID2` are the identities of the considered nodes.
+ `salt` is the salt value that can be private or public depending on the peering direction (inbound/outbound).
+ `hash` is the `blake2b` hash function.
+ `XOR` is the bitwise logical *xor* operation.
+ ``||`` is the concatanation operation.

Note that the value used as the distance is an unsigned integer derived from the first 4 bytes of the byte array after the `XOR` operation.

In order to connect to new neighbors, each node with ID ownId and public salt ζ keeps a list of potential peers derived via [Mana rank](#Mana_rank) that is sorted by their distance d(ownId, ·, ζ). Then, the node sends them peering requests in *ascending order*, containing its own current public salt and a timestamp (its nodeID is already embedded in the [packet](#Packet) containing the peering request). 
The connecting node repeats this process until it has established connections to enough neighbors or it finds closer peers. Those neighbors make up its list of chosen neighbors. This entire process is also illustrated in the following pseudocode:

```
Inputs: 
    k: desired amount of neighbors; 
    C: current list of chosen neighbors; 
    P: list of potential peers;
    ownID: own nodeID 
    pub_salt: own public salt;
    

P_sorted ← sortByDistanceAsc(P, ownID, pub_salt)
foreach p ∈ P_sorted do
    peeringRequest ← sendPeeringRequest(p)
    if peeringRequest.accepted then 
        append(C, p)
        if |C| == k/2 then 
            return
```

More specifically, after sending a peering request a node must:
* wait to get a [Peering Response](#Peering_Response) that could be positive or negative. 
    * If positive, add the peer to its chosen neighbor list
    * If negative, filter out the peer from future request until the next salt update.
    * If after a timeout no response is received, try again for a fixed Max_peering_attempts or filter out the peer from future request until the next salt update.

Similarly to the previous case, in order to accept neighbors, every node with ID ownID must generate a private salt ζ_private.

Upon reception of a [Peering Request](#Peering_Request), a peer *must* make a decision to accept, reject  or discard the request by:
* veryfing that the signature of the [Peering Request](#Peering_Request) packet is valid and discard the message otherwise;
* checking that the `timestamp` field is fresh and discard the message otherwise;
* checking that the *mana* of the requester peer is within the own [Mana rank](#Mana_rank) and send back a *negative* [Peering Response](#Peering_Response) otherwise.
* checking that the requester salt matches its hash chain by:
    * taking the difference between the timestamp of the peering request and the time the initial salt was set, and then dividing this number by 3 hours, rounding down;
    * hashing the requester public salt as many times as the number of salt changes;
    * finally, if the result does not match the initial salt, discard the peering request;
* applying a statistical test to the request defined as *d(remoteID, ownID, ζ_remote) < θ* for a fixed threshold θ, and discard the message otherwise;
* accept the peering request by sending bakc a *positive* [Peering Response](#Peering_Response) if either one of the following conditions is satisfied, and send back a *negative* [Peering Response](#Peering_Response) otherwise:
    * the current size of the accepted neighbors list is smaller than *k/2*; 
    * the distance defined as *d(ownID, remoteID, ζ_private)* is smaller than the current furtherest accepeted neighbor. In this case, send a [Peering Drop](#Peering_Drop) message to drop the furtherest accepeted neighbor replaced by the requester peer. 

## Neighbor Removal

Neighbor removal can occur for several reasons:
* A node is replacing a neighbor with a better (in terms of distance function) one;
* From the gossip layer, the connection with a neighbor is lost;
* If some form of reputation or bad behavior is being monitored, a neighbor could be dropped in case of misbehavior.

Indepenently from the reason, when a peer drops a neighbor *must* send a [Peering Drop](#Peering_Drop) message and remove the neighbor from its chosen/accepted neighbor list. Upon reception of a [Peering Drop](#Peering_Drop) message, the peer *must* remove the dropping neighbor from its chosen/accepted neighbor list.

## Mana rank

In the following for loop, we iterate over a map called `manaRank` containing the list of the node's identities for each mana value (key of the map). The `targetMana` is the mana value of the node performing the ranking. 
```
for mana, identities := range manaRank {
    switch mana > targetMana {
    case true:
        if float64(mana)/float64(targetMana) < ro {
            upperSet = append(upperSet, identities...)
        }
    case false:
        if mana == 0 || mana == targetMana {
            break
        }
        if float64(targetMana)/float64(mana) < ro {
            lowerSet = append(lowerSet, identities...)
        }
    }
}

set := append(upperSet, lowerSet...)
```

## Messages

Each message is encapsulated into a `data` field of a `Packet` message. The `type` of the different messages *must* be specified in the `type` field. Each message *must* be signed with the ed25519 private key of the sender's [identity](#Node_identities) and contain the related public key to allow the message receiver to verify the signature. All the received messages *must* be verified and discard those with invalid signature.

In the following, the **protocol buffer** language is used to define the structure of each message.

### Packet

```
message Packet {
  uint32 type = 1;
  bytes data = 2;
  bytes public_key = 3;
  bytes signature = 4;
}
```
* `type` defines the type of the message:
    * `0x1A`: [`PeeringRequest`](#Peering_Request) message;
    * `0x1B`: [`PeeringResponse`](#Peering_Response) message;
    * `0x1C`: [`PeeringDrop`](#Peering_Drop) message;
* `data` contains the payload of the message (e.g., a `PeeringRequest` message).
* `public_key` is the ed25519 public key of the peer's [identity](#Peer_identities) used to verify its signatures.
* `signature` is the ed25519 signature of the `data` field, signed by using the private key of the peer's [identity](#Peer_identities).

### Peering Request

```
message PeeringRequest {
  int64 timestamp = 1;
  Salt salt = 2;
}
```
* `timestamp` is defined as the unix timestamp.
* `salt` is the public salt of the requester defined as:

```
message Salt {
    bytes bytes = 1;
    fixed64 exp_time = 2;
} 
```

* `bytes` is the value of the salt.
* `exp_time` is the expiration time of the salt.

### Peering Response

```
message PeeringResponse {
  bytes req_hash = 1;
  bool status = 2;
}
```
* `req_hash` is the `blake2b` digest of the corresponding received [`PeeringRequest`](#Peering_Request) message.
* `status` is the response (true or false) of the peering request.

### Peering Drop

```
message PeeringDrop {
  int64 timestamp = 1;
}
```
* `timestamp` is defined as the unix timestamp.

# Drawbacks

- Public and private salts make the distance seen by nodes asymmetric:
    - Makes more challenging to prove good behaviour;
    - Gives more freedom to the receiver side;
- Opening a port for exchanging autopeering messages could be abused:
    - Requires additional protections and counter-mesasures against potential distributed denial of service attacks;
    - Cheap and easy to run such an attack on few targets;
- Accepting or dropping a neighbor over a better one might generate a cascade effect:
    - Salt updates should not happen too frequently


# Rationale and alternatives

- Depending on the requirements of the consensus mechanism, a neighbor selection with more properties could be required. As such, the [ar-row autopeering](https://iota.cafe/t/ar-row-autopeering/266) should be considered as a viable alternative.

# Unresolved questions

- What parts of the design do you expect to resolve through the RFC process
  before this gets merged?
- What parts of the design do you expect to resolve through the implementation
  of this feature before stabilization?
- What related issues do you consider out of scope for this RFC that could be
  addressed in the future independently of the solution that comes out of this
  RFC?


<!--stackedit_data:
eyJoaXN0b3J5IjpbMTcwNTQzNjU0Nl19
-->