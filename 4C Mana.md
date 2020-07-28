+ Feature name: `Mana`
+ Start date: 2020-05-04

# Summary
This RFC defines the *Mana* calculations.

# Motivation

The Coordicide project introduces node identities. In order to discourage the creation of counterfeit identities (Sybils), we require a Sybil protection mechanism, which links a certain difficult-to-obtain resource to each node. In the Coordicide, we propose to use the stake as such a resource, and we refer to it as Mana. Mana is a crucial aspect in the following building blocks:

* Rate control: the throughput of each node is bounded by the Mana owned.
* Auto peering: nodes with similar Mana will be neighbors with high probability.
* Voting: the weight of a vote should be proportional to the Mana owned.
* DRNG: the DRNG committees will be constituted by the high Mana nodes.

In the future, we expect Mana to be only a specific aspect of a more generic reputation system which might include other criteria, such as penalties for misbehavior or incentives for helping the network.

Specifically, Mana is a function whose input is a transaction (or the null set) and the last Mana state, and whose output is the Mana state vector, which gives the amount of Mana staked to each node. 

Also, criteria which are external to the system (informally, any sort of “real-world importance”) may be used.

We stress here that this process does not influence the actual balances in any way, but it is only used to give higher weight to “trusted” nodes.

# Detailed design

We choose to use a mixed Mana calculation, where the node, when issuing a transaction, chooses which type (type 1 or type 2) of Mana it will get for that said transaction.

For that, when the node issues a transaction, after choosing one of the two options of Mana calculations, will add this information to the transaction - together with the Node ID of the node to whom the Mana was pledged (that is not necessarily the same node who signed the transaction)- into the fields `Mana Receiver` and `Mana Type`. The other nodes will update their Mana perception (adding the Mana obtained from this transaction) accordingly to the choice of the issuing node. The two types of Mana (and their respective Effective Mana) have to be stored separately and then added to compute the total Effective Mana. The reason behind that is the decaying factor used for Mana 2, that cannot be applied to Mana 1 at the same time.

The goal of this algorithm is to update the *Mana 1*, *Mana 2*, and the *Effective Mana* vectors. The Effective Mana will always be an exponential moving average applied to each Mana state. Each type of Mana has certain properties that will give the nodes advantages in different situations. For instance, if a transaction in sending funds to cold storage, it will probably be more advantageous to use Mana 1; otherwise it might be more advantageous to use Mana 2.


## Parameter Values
The following parameters will be hard-coded defaults. We do not have explicit rules to punish nodes that clearly do not use these parameters, but we expect that they would be eventually ignored, due to other implicit mechanisms. For instance, even if the Mana database of a certain node is significantly different from the other nodes' view (causing a divergence from the majority's opinion in the voting protocol), with a very high probability its opinion will not affect the final outcome of the voting. For other modules (like DRNG or rate control), a node with a significantly different perception of Mana will be ignored and will not harm the network. Thus, we believe that the nodes have plenty incentives to follow the hard coded rules.


* $\gamma$ (`decay`)- decay factor on Mana 2 - (for a half life of ~6 hours we need $\gamma=0.00192541 \frac{1}{\text{min}}$)
* $\alpha$ (`EMA_coeff`)- moving averages factor - (the same as $\gamma$, for now)
* $\beta$ (`scale`)- scaling factor for Mana 2 - (for now, we use $\beta=1$)
* $n_{\text{max}}$ (`n_max`)- largest acceptable period of time without updating the Effective Mana vectors - (for now, we use $n_{\text{max}}=30$ minutes) 





## Initialization

When a node joins the network, it will query other nodes to get their snapshot file. This file has two relevant databases: the `Ledger State` and the`Mana State`. The Ledger State will be indexed by addresses and UTXO outputs and -for each UTXO output- contains:

* Its balance
* Its timestamp
* Its Mana pledge type 
* Its Pledged Node ID 
* Its address


The Mana State is a database which, for each Node ID, contains:

* Its Mana 1 Balance 
* Its Effective Mana 1 
* Its Mana 2 Balance
* Its Effective Mana 2 

All these states, theoretically, should be floating-point variables, since we are going to calculate some exponentials (like $\exp(-t)$) when updating the function.

Additionally, the Mana State database will contain the last time it was updated (as measured by the local clock of the queried node). 

## Mana State update

The Mana State database only will be updated in three different situations:

* When transactions are snapshotted
* When the function is called as a consequence of external events (like the DRNG or the rate control modules).
* When the snapshot file was not updated in the last $n_{\text{max}}$ period of time.


In the second and third cases, no new transactions will be added and the databases will only be updated in respect to time.

#### Example 1: 
Suppose a node has a snapshot file that was updated at a certain point in time `T` in the past. If the node wants to update it at a certain (local) time `t` in order to add the set of transaction `set_of_transactions`, it will call the functions:

```
Update_Ledger_State(set_of_transactions)
Update_Mana(t,T,set_of_transactions)
```

In this case, in general, all the databases in the snapshot with will be modified (i.e. , the Ledger State, both Mana Balances, both Effective Mana vectors and the Last time it was updated).


#### Example 2: 

Suppose that the DRNG module wants to access the Mana database stored in a snapshot file that was updated at a certain point in time `T` in the past. If that node has a (local) time `t`, and `[]` stands for an empty list, then the DRNG module will call the function:

```
Update_Mana(t,T,[])
```

In this case, in general, all the databases in the snapshot file besides the Ledger State will be modified.


Next, we detail how each of the particular Mana databases will be updated.

### Mana 1

When funds are spent from an address, an equal amount of Mana 1 will be pledged to a node. This pledge is revoked once the funds are spent again and pledged to a different node. Notice that we effectively add and revoke the Mana only when the transactions are snapshotted, so double spends and any invalid transactions will not affect the Mana State. 

The Mana 1 vector does not need to be updated periodically; instead, it has to be updated only when new transactions are added to the Ledger State in the snapshot file. Just before updating the Mana 1 vector, it has to be stored in a temporary vector: the last Mana 1 state and the time since the last update are going to be used for the Effective Mana 1 calculations. This temporary vector can be deleted right after the Effective Mana 1 vector update.

The update of the Mana 1 state goes as follows:

* A new transaction, with $n$ inputs $I_j$ (of value $x_j$) and $m$ outputs $O_j$ (of value $y_j$) is added to the Ledger State. Suppose that this transaction pledges Mana to a node $N$. 

![](https://i.imgur.com/bKMkUbK.png)

* Add $\sum_{j=1}^{m}y_j$ (or, equivalently, $\sum_{j=1}^{n}x_j$) to the Mana 1 vector of the node $N$.
* Each input $I_j$ corresponds to some UTXO stored in the Ledger State. Then, we locate its corresponding Pledged Node ID ($\text{Node}(I_j)$) and subtract $x_j$ from the Mana state of the node $\text{Node}(I_j)$, for each $I_j$, $j=1,\dots,n$.

![](https://i.imgur.com/0X8pXAU.png)

### Effective Mana 1

There are two reasons to update the Effective Mana 1 vector:

* A new transaction was added to the Ledger State
* Too much time has passed since it was last updated, or the function was called with no additional transactions being added to the Ledger

We introduce two different algorithms, one to each situation above. The reason behind that is to allow the inclusion of the Mana 1 relative to old transactions (meaning that the transactions do not have to be added in time order) to the Mana state vector. For the Effective Mana 1 update, we always assume that time is discrete, with one second as the smallest possible time step. We also assume that the maximum acceptable period of time without updating the Effective Mana 1 state is $n_{\text{max}}$.

#### Updating with no additional transactions

Suppose that the current time (as measured by the node's local clock) is $t$ and the last update of the vector was $n$ units of time ago (meaning that the last update was at time $t-n$). In this case, we update the Effective Mana 1 entries as follows:

\begin{align}
\text{Effective_Mana_1(Node_i)} =&  (1-\alpha)^n\text{Effective_Mana_1(Node_i)}\\
+&(1-(1-\alpha)^n)\text{Mana_1(Node_i)}
\end{align}

where $\alpha$ is a parameter set according to the desired properties of the moving averages. 

#### Updating because a new transaction was added to the Ledger State

When a new transaction is added to the Ledger, first the node will update  the Effective Mana 1 vector as defined above. Then, suppose the current time is $t$ (as measured by the node's local clock) and the timestamp of the recently added transaction points to $t-\delta$. If the Mana 1 state of a node $i$ instantly before we added this transaction was $\text{Mana_1}^{-}(\text{Node_i})$ and the new Mana 1 state, after the addition of this transaction is $\text{Mana_1}^{+}(\text{Node_i})$, then we update the Effective Mana 1 vector adding to each $\text{Effective_Mana_1(Node_i)}$ entry the term:

$$
(1-(1-\alpha)^\delta)[\text{Mana_1}^{+}(\text{Node_i})-\text{Mana_1}^{-}(\text{Node_i})]
$$

Obs: This term can be negative, but the resulting Effective Mana 1 cannot.
Obs 2: Here, we need to use an old value of $\text{Mana_1}$. So whenever we are updating the Mana State, we need to temporarily store the $\text{Mana_1}$ vector to update the $\text{Effective_Mana_1}$ state. After the $\text{Effective_Mana_1}$ was already updated, we can get rid of this temporary (and outdated) vector.

### Mana 2

When funds are spent from an address, an amount of Mana 2 proportional to the funds and the time the funds spent in the address will be pledged to a node. This pledge is never revoked, as opposed to Mana 1. Nevertheless, the Mana 2 of a node will *decay* over time. Again, we assume that the maximum acceptable period of time without updating the Mana 2 state is $n_{\text{max}}$. The update of the Mana 2 state goes as follows:

#### Updating with no additional transactions

Suppose that the current time is $t$ (as measured by the node's local clock) and the last update was $n$ units of time ago (meaning that the last update was at time $t-n$). In this case, we update the Mana 2 vector as follows:

$$
  \text{Mana_2}(\text{Node_i})=\text{Mana_2}(\text{Node_i})e^{-\gamma n}
$$

where $\gamma$ is a parameter set accordingly to the desired properties of the decay (a half life).

#### Updating because a new transaction was snapshotted

Suppose a new transaction, with $n$ inputs $I_j$ (of value $x_j$) is snapshotted. This transaction pledges Mana 2 to a node $N$ and its timestamp points to an instant that happened $\delta$ units of time ago (relatively to the node's local clock). First the node will update  the Mana 2 vector as defined above. Then, it will calculate the total pending Mana that was generated until the time $t-\delta$ by the addresses relative to $I_j$, $j=1,\dots,n$, applying, for each $I_j$, the formula:

$$
  PM(I_j)=\sum_{k=1}^{p}\frac{\beta}{\gamma}x_k(1-e^{-\gamma \Delta_{k}})
$$ where $\Delta_{k}$ is the difference between the timestamps of the output relative to $I_j$ and the current transaction timestamp $t-\delta$; $\gamma$ is the same parameter as above and $\beta$ will have influence on the maximum total amount of Mana 2 in the system. Then, we update node $N$'s Mana 2 entry, adding the following term:

$$
 e^{-\gamma \delta}\sum_{j=1}^{n}PM(I_j)
$$

This value has to be temporarily stored to enable the Effective Mana 2 update.

### Effective Mana 2

#### Updating with no additional transactions

Suppose that the current time is $t$ and the last update was $n$ units of time ago. In this case, we update the Effective Mana 2 vector as follows:

\begin{align}
\text{Effective_Mana_2(Node_i)} =&  (1-\alpha)^n\text{Effective_Mana_2(Node_i)}\\
+&\frac{1-(1-\alpha)^n\exp(n\gamma)}{1-(1-\alpha)\exp(\gamma)}\alpha\text{Mana_2(Node_i)}
\end{align}

where $\alpha$ is the same parameter set for the Effective Mana 1 and $\gamma$ is the same parameter used to update the Mana 2 vector. Notice that here, the value of $\text{Mana_2(Node_i)}$ used is the one already updated. 

#### Updating because a new transaction was snapshotted

When a new transaction is snapshotted, first the node will update  the Effective Mana 2 vector as defined above. Then, if this transaction pledges Mana to a node $N$ and its timestamp points to a instant that happened $\delta$ units of time ago (relatively to the node's local clock), we update the Effective Mana 2 vector adding to the Effective Mana 2 of the node $N$ the term:

$$
 \frac{1-(1-\alpha)^\delta\exp(\delta\gamma)}{1-(1-\alpha)\exp(\gamma)}\alpha e^{-\gamma \delta}\sum_{j=1}^{n}PM(I_j)
$$

where the term $e^{-\gamma \delta}\sum_{j=1}^{n}PM(I_j)$ is the same it was added when updating the Mana 2 vector. Here, we need to use a value calculated by the function that updates the Mana 2 vector. So whenever we are updating the Mana 2 vector, we need to temporarily store this amount $e^{-\gamma \delta}\sum_{j=1}^{n}PM(I_j)$ to update the Effective Mana 2 vector. After the $\text{Effective_Mana_2}$ is already updated, we can get rid of this temporary variable.

# Pros and cons

## Using only Mana 1 

In this case, the nodes will not choose if they want Mana 1 or 2 pledged: they will always get Mana 1. 

* Using only Mana 1 has a game theoretical problem, because since the Mana is revoked when the funds are used again, the node does not know for how long he will have the Mana 1.
* On the other hand, Mana 1 is probably simpler to understand and does not need to be updated frequently in low activity periods (at least after a certain point in time, where the moving averages had already stabilized).
* Offline nodes might not be punished with this model.

## Using only Mana 2

In this case, the nodes will not choose if they want Mana 1 or 2 pledged: they will always get Mana 2.

* Even though it is harder to understand it, with this model we fix the game theoretical problem present in Mana 1. 
* Nevertheless, the decay of Mana 2 introduces a new problem: in times of low activity, the total amount of Mana 2 of the network also decays, making it easier to take control of a large fraction of the total Mana 2.
* In low activity periods, even though the Mana 2 and effective Mana 2 decay, the fraction of Mana 2 of each node remains roughly the same (again, at least after a certain point in time, where the moving averages had already stabilized), meaning that there is no need to update it so frequently.

## Using a mixed Mana model

Using a mixed model means that the nodes, for each transaction, will choose if they want Mana 1 or 2 pledged. 

* This option will be probably more difficult to understand and implement, but both main problems of the last two options (the game theoretical problems of Mana 1 and the decay problems of Mana 2) seem to be solved. 
* Instead of reasoning which Mana the nodes will prefer, we will see in practice their options.
* Nevertheless, the combination of the two models brings a new problem: to have a reasonably updated Mana State vector, the Mana 2 vector will have to be updated even in times of low activity. This happens because since only Mana 2 decays, the fraction of Mana of each node will not remain constant over time, even when activity is low. We consider that this problem is not serious as the main problems found when using a non-mixed model, since low activity times should not be that common and updating the Mana vectors is an expected function of the nodes. 

# Code

In this section, for the sake of clarification, we introduce an example of code of the functions defined above. 

Obs: `set_of_transactions` can be an empty list.
Obs2: `time(transaction)` stands for the timestamp of a transaction. `t` and `last_update_time` are times from the node's local clock.
Obs 3: `node(transaction)` and `mana_type(transaction)` stand for the node to which the Mana of the transaction was pledged and the type of Mana pledged.
Obs 4: If a node wants to build the Mana database from scratch, i.e, without a already initialized Mana State, it suffices to set all Mana and Effective Mana States to zero and call the function `Update_Mana(t,last_update_time,set_of_transactions)` setting `last_update_time` to any value of time.

```
function Update_Mana_2_time(t,last_update_time):
    for each node i:
        Mana_2(i) = Mana_2(i)*exp(-decay*(t-last_update_time))  
```
```
function Update_Eff_Mana_1_time(t,last_update_time):
    for each node i:
        Eff_Mana_1(i) = (1-EMA_coeff)**(t-last_update_time)*Eff_Mana_1(i)
                        +(1-(1-EMA_coeff)**(t-last_update_time))*Mana_1(i)
```
```
function Update_Eff_Mana_2_time(t,last_update_time):
    for each node i:
        Eff_Mana_2(i) = (1-EMA_coeff)**(t-last_update_time)*Eff_Mana_2(i)
                        +(1-(1-EMA_coeff)**(t-last_update_time)
                        *exp(n decay))/(1-(1-EMA_coeff)*exp(decay))
                        *EMA_coeff*Mana_2(i)
```
```
function Update_Mana_1_tr(transaction):
    Mana_1(node(transaction)) = Mana_1(node(transaction))
                                +sum_outputs(transaction) 
    for each inp in input(transaction):
        Mana_1(node(inp)) = Mana_1(node(inp))-amount(inp)   
```
```
function Update_Mana_2_tr(t,transaction):
    for each inp in input(transaction):
        Mana_2(node(transaction)) = Mana_2(node(transaction))
                            +exp(-decay (t-time(transaction)))
                            *scale/decay*amount(inp)
                            *(1-exp(-decay*(time(transaction)-time(inp)))) 
```
```
function Update_Eff_Mana_1_tr(t,transaction,Mana_old_1):
    for each node i:
        if Mana_1(i) != Mana_old_1(i):
            Eff_Mana_1(i) = Eff_Mana_1(i)
                            +(1-(1-EMA_coeff)**(t-time(transaction)))
                            *[Mana_1(i)-Mana_old_1(i)]
```
```
function Update_Eff_Mana_2_tr(t,transaction,Mana_old_2):
    if Mana_2(i) != Mana_old_2(i):
        Eff_Mana_2(node(transaction)) = Eff_Mana_2(node(transaction))
                        +(1-(1-EMA_coeff)**(t-time(transaction))*exp(decay (t-time(transaction))))/(1-(1-EMA_coeff)*exp(decay))
                        *EMA_coeff*[Mana_2(node(transaction))-Mana_old_2(node(transaction))]
```
```
function Update_Mana(t,last_update_time,set_of_transactions):
    Update_Mana_2_time(t,last_update_time)
    Update_Eff_Mana_1_time(t,last_update_time)
    Update_Eff_Mana_2_time(t,last_update_time)
        
    for each transaction tr in set_of_transactions:  
        for each node i:
            Mana_old_1(i) = Mana_1(i)
            Mana_old_2(i) = Mana_2(i)
        if mana_type(tr) == 1: 
            Update_Mana_1_tr(tr)
            Update_Eff_Mana_1_tr(t,tr,Mana_old_1)
        if mana_type(tr) == 2: 
            Update_Mana_2_tr(t,tr)
            Update_Eff_Mana_2_tr(t,tr,Mana_old_2)        
    last_update_time  = t        
```


<!--stackedit_data:
eyJoaXN0b3J5IjpbLTE3Nzc2OTY0NzldfQ==
-->