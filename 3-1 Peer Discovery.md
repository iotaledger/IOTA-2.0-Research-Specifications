+ Feature name: `Peer Discovery`
+ Start date: 2020-04-13
+ RFC PR: [iotaledger/protocol-rfcs#0000](https://github.com/iotaledger/protocol-rfcs/pull/0000)


# Summary
This RFC defines the *Peer Discovery* protocol, its logic and the different messages exchanged.

# Motivation
In order to establish connections, an IOTA node needs to discover and maintain a list of the reachable IP addresses of other peers. Moreover, some external modules, such as the *Neighbor Selection* and the *Fast Probabilistic Consensus (FPC)* may require an updated list of all the known peers.

# Terminology
Throughout this RFC the terms `Node` and `Peer` are used interchangeably. 

# Detailed design

To bootstrap the peer discovery, a node *must* be able to reach one or more entry nodes. Thus, the implementation of the protocol *must* provide a hard-coded list of trusted **entry nodes** run by the IF or by trusted community members that answer to peer discovery messages coming from new nodes joining the IOTA network. This approach is a common practice of many distributed networks [[Neudecker 2018]](https://ieeexplore.ieee.org/iel7/9739/8649699/08456488.pdf). 
Public Key-based Cryptography (PKC) *must* be used for uniquely [identifying](#Node_identities) peers and for authenticating each message. 
In a nutshell, [*Ping*](#Ping) messages are sent to verify a given peer and, upon reception of a valid [*Pong*](#Pong) message as a response from that peer, the peer is verified.
Once a peer has been verified, it can be queried to discover new peers by sending a [*DiscoveryRequest*](#DiscoveryRequest) message. As a response, a [*DiscoveryResponse*](#DiscoveryResponse) message should be expected, containing a list of new peers that *should* be verified.
The main goal of the *Peer Discovery* protocol is to expose an interface providing the list of all the verified peers.

This process is sketched in the following figure and detailed in the following subsections:

![](https://i.imgur.com/U51tPeK.png)


## Node identities
Every node has a cryptographic identity, a key on the ed25519 elliptic curve. The `blake2b` hash of the public key of the peer serves as its identifier or `node ID`.

## Verification
The verification process aims at both verifying peer identities and checking their online status. Each peer keeps a list of all the known peers called `known_peer_list`. Elements of such a list contain a [Peer](#Peer) and are ordered based on their verified status: the oldest verified peer (or unverified peer) as the head and the most recent verified peer as the tail. This way should allow to first verify newly discovered (and thus still unverified) peers and re-verify (to confirm their online status) older peers by iterating over the `known_peer_list`.

The verification process always initiates from a [Ping](#Ping) message. Upon reception of a [Ping](#Ping) message, a peer *must* check its validity by:
* verifying that the signature of the [Ping](#Ping) message is valid and discard the message otherwise;
* checking that the `version` and `network_id` fields match its configuration and discard the message otherwise ;
* checking that the `timestamp` field is fresh and discard the message otherwise;
* checking that the `dest_addr` matches its IP address and discard the message otherwise.

Upon successful validation of a received [Ping](#Ping) message, a peer *should* respond with a [Pong](#Pong) message. In case the peer sender of the *Ping* message is a new peer, the receiver peer *should* add it to its `known_peer_list` (so that the verification process can also occur the other way around). 

Upon reception of a [Pong](#Pong) message, a peer *must* check its validity by:
* verifying that the signature of the [Pong](#Pong) message is valid and discard the message otherwise;
* checking that the `req_hash` field matches a request (i.e., *Ping*) previously sent and not expired;
* checking that the `dest_addr` matches its IP address and discard the message otherwise.

Upon successful validation of a received [Pong](#Pong) message, a peer *should*:
* add the peer sender of the *Pong* message to a list of verified peers called `verified_peer_list`;
* move the peer entry of the `known_peer_list` to the tail.

## Removal
While verifying a new peer, if no or an invalid *Pong* message is received after `max_verify_attempts` attempts, the peer *should* be removed from the `known_peer_list`. 

Each peer on the `verified_peer_list` *should* be re-verified after `verification_lifetime` hours; while re-verifying a peer, if no or invalid *Pong* message is received after `max_reverify_attempts` attempts, the peer *should* be removed from the `verified_peer_list`.

## Discovery
Each peer entry of the `verified_peer_list` can be used to discover new peers. This process initiates by sending a [DiscoveryRequest](#DiscoveryRequest) message.

Upon reception of a [DiscoveryRequest](#DiscoveryRequest) message, a peer *must* check its validity by:
* checking that the peer sender of the [DiscoveryRequest](#DiscoveryRequest) message is a verified peer (i.e., is stored in the `verified_peer_list`) and discard the message otherwise;
* verifying that the signature of the [DiscoveryRequest](#DiscoveryRequest) message is valid and discard the message otherwise;
* checking that the `timestamp` field is fresh and discard the message otherwise;

Upon successful validation of a received [DiscoveryRequest](#DiscoveryRequest) message, a peer *should* reply with a [DiscoveryResponse](#DiscoveryResponse) message.

Upon reception of a [DiscoveryResponse](#DiscoveryResponse) message, a peer *must* check its validity by:
* verifying that the signature of the [DiscoveryResponse](#DiscoveryResponse) message is valid and discard the message otherwise;
* checking that the `req_hash` field matches a discovery request (i.e., *DiscoveryRequest*) previously sent and not expired.

Upon successful validation of a received [DiscoveryResponse](#DiscoveryResponse) message, a peer *should* add the peers contained in the `peers` field to the top of the `known_peer_list`.

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
    * `0x0A`: [`Ping`](#Ping) message;
    * `0x0B`: [`Pong`](#Pong) message;
    * `0x0C`: [`DiscoveryRequest`](#DiscoveryRequest) message;
    * `0x0D`: [`DiscoveryResponse`](#DiscoveryResponse) message;
* `data` contains the payload of the message (e.g., a `ping` message).
* `public_key` is the ed25519 public key of the peer's [identity](#Peer_identities) used to verify its signatures.
* `signature` is the ed25519 signature of the `data` field, signed by using the private key of the peer's [identity](#Peer_identities).

### Ping

```
message Ping {
  uint32 version = 1;
  uint32 network_id = 2;
  int64 timestamp = 3;
  string src_addr = 4;
  uint32 src_port = 5;
  string dst_addr = 6;
}
```
* `version` and `network_id` are used to classify the protocol.
* `timestamp` is defined as the unix timestamp.
* `src_addr` is the IP address, as a string form, of the sender (e.g., "192.0.2.1", "[2001:db8::1]"). 
* `src_port` is the listening port of the sender.
* `dst_addr` is the string form of the receiver's IP address. This provides a way to discover the external address (after NAT).


### Pong

```
message Pong {
  bytes req_hash = 1;
  ServiceMap services = 2;
  string dst_addr = 3;
}
```
* `req_hash` is the `blake2b` digest of the corresponding received [`ping`](#Ping) message.
* `services` are the [services](#ServiceMap) supported by the `pong` message sender.
* `dst_addr` is the string form of the receiver's IP address. This *MUST* mirror the `src_addr` of the [`ping`](#Ping)'s IP message. It provides a way to discover the external address (after NAT).

### DiscoveryRequest

```
message DiscoveryRequest {
  int64 timestamp = 1;
}
```
* `timestamp` is defined as the unix timestamp.

### DiscoveryResponse

```
message DiscoveryResponse {
  bytes req_hash = 1;
  repeated Peer peers = 2;
}
```
* `req_hash` is the `blake2b` digest of the corresponding received [`DiscoveryRequest`](#DiscoveryRequest) message.
* `peers` is a list of *some* randomly chosen [peers](#Peer) known by the sender of the `DiscoveryRepsonse` message. 

### Peer

```
message Peer {
  bytes public_key = 1;
  string ip = 2;
  ServiceMap services = 3;
}
```
* `public_key` is the ed25519 public key of the peer's [identity](#Peer_identities) used to verify its signatures.
* `ip` defines the string form of the peers IP address.
* `services` are the [services](#ServiceMap) supported by the peer.

### ServiceMap

`ServiceMap` is a data structure used to map a service ID to its tuple `NetworkAddress`.

```
message ServiceMap {
  map<string, NetworkAddress> map = 1;
}
```
* `map` maps a service ID to the corresponding `NetworkAddress` (e.g., map["autopeering":NetworkAddress{"udp", 14636}]).

`NetworkAddress` defines the tuple `<network, port>` of a service:

```
message NetworkAddress {
  string network = 1;
  uint32 port = 2;
}
```
* `network` defines the network type (e.g., "tcp", "udp") of the service.
* `port` defines the listening port of the service.


# Drawbacks

+ The *Peer Discovery* aims at discovering as many peers as possible. This is a requirement of both *Neighbor Selection* and *FPC*. On the other hand, this exposes the public IP of all the IOTA nodes.
+ Scalability of this protocol might be problematic since any peer needs to discover the entire set of the peers.

# Rationale and alternatives

- Why is this design the best in the space of possible designs?
- What other designs have been considered and what is the rationale for not
  choosing them?
- What is the impact of not doing this?

# Unresolved questions

- What parts of the design do you expect to resolve through the RFC process
  before this gets merged?
- What parts of the design do you expect to resolve through the implementation
  of this feature before stabilization?
- What related issues do you consider out of scope for this RFC that could be
  addressed in the future independently of the solution that comes out of this
  RFC?

