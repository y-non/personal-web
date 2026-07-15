---
title: "SQL Is Not Boring: The Hidden Systems Behind Everyday Apps"
published: 2026-07-15
description: "A story-driven look at deadlocks, B-Tree indexes, async programming, Window Functions, funnels, surge pricing, and WebSockets—without drowning in textbook definitions."
image: "./images/sql-hidden-systems-banner.jpg"
tags: ["SQL", "Database", "Backend", "System Design", "WebSockets", "Data Engineering"]
category: "Programming"
draft: false
---

# SQL Is Not Boring: The Hidden Systems Behind Everyday Apps

For a long time, I thought SQL was just the language you used to get data out of a database.

You write a `SELECT`, add a `WHERE`, maybe join two tables, and move on with your life.

That view works when the database is small and only a few people are using the application. But once real users arrive, the database stops behaving like a quiet spreadsheet. It starts looking more like a city during rush hour:

- thousands of requests are moving at the same time;
- some transactions are fighting over the same rows;
- certain roads are fast because somebody built an index;
- other roads are completely blocked;
- dashboards need historical context, not just individual records;
- frontend screens expect updates before the user presses refresh.

That is where database knowledge becomes much more interesting.

This article is not a dictionary of SQL terms. It is a tour through the hidden systems behind the apps we use every day—and the mental models that helped me understand them.

## 1. A Database Deadlock Is Basically Two Cars Refusing to Reverse 

Imagine a narrow intersection with two cars.

- Car A has entered from the north and wants to turn east.
- Car B has entered from the east and wants to turn north.
- Each car is blocking the road the other one needs.
- Neither driver can move forward.
- Neither driver wants to reverse.

Nothing is technically broken. Both cars are working exactly as intended. The problem is that their movements depend on each other.

That is a **deadlock**.

In database terms, the cars are transactions and the pieces of road are locked rows.

```sql
-- Transaction A
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;

-- Transaction B, running at the same time
BEGIN;
UPDATE accounts SET balance = balance - 50 WHERE id = 2;
UPDATE accounts SET balance = balance + 50 WHERE id = 1;
```

Transaction A locks account `1` and waits for account `2`.

Transaction B locks account `2` and waits for account `1`.

Now both transactions are staring at each other in the middle of the intersection.

### How does the database escape?

A database such as PostgreSQL periodically checks whether waiting transactions form a cycle. When it detects a deadlock, it chooses one transaction as the victim, aborts it, and allows the other transaction to continue.

In human terms, a traffic officer arrives and tells one driver:

> “You have to reverse. The other car goes first.”

The cancelled transaction receives an error, so the application should normally retry it when retrying is safe.

### The better fix: make everyone follow the same road rule

Retrying is useful, but preventing the conflict is better.

A common technique is to acquire locks in a consistent order:

```sql
BEGIN;

-- Every code path locks accounts in the same order
SELECT id
FROM accounts
WHERE id IN (1, 2)
ORDER BY id
FOR UPDATE;

-- Perform the updates after the locks are acquired
UPDATE accounts
SET balance = CASE
  WHEN id = 1 THEN balance - 100
  WHEN id = 2 THEN balance + 100
END
WHERE id IN (1, 2);

COMMIT;
```

The exact implementation depends on the database and query, but the principle is simple:

- do not let one transaction lock A then B;
- while another transaction locks B then A;
- define one order and make every transaction respect it.

💡 **The practical lesson:** a deadlock is not proof that the database is unreliable. It is usually evidence that two valid workflows acquired shared resources in an inconsistent order.

## 2. A B-Tree Index Is the Difference Between Reading a Book and Using Its Index 📚

Suppose somebody gives you a 1,000-page book and asks:

> “Where is the paragraph about transaction isolation?”

Without an index, you start at page one and scan every page until you find it.

That is roughly what a **sequential scan** does.

```sql
SELECT *
FROM users
WHERE email = 'yonnon@example.com';
```

If `email` has no useful index, the database may need to inspect a huge portion of the table. On a tiny project, that can still feel instant. On a table with hundreds of millions of rows, it becomes a very different story.

Now imagine the same book has an alphabetical index at the back:

1. Look under **T**.
2. Find **Transaction isolation**.
3. Jump directly to page 742.

A B-Tree index gives the database a similar navigation structure.

```sql
CREATE INDEX idx_users_email ON users(email);
```

The data is organized in a balanced tree, so the database repeatedly narrows the search space instead of checking every row.

A simplified mental picture looks like this:

```text
                         [M]
                      /       \
                  [D, H]     [R, W]
                 /  |  \     /  |  \
               ... ... ... ... ... ...
```

Each comparison tells the database which branch can be ignored.

With one billion indexed values, the database does not need one billion comparisons. The tree can often reach the relevant section in a small number of steps, followed by a lookup of the actual table row.

### But an index is not free speed

This is where beginner explanations often become misleading.

An index can make reads dramatically faster, but it also has costs:

- it consumes storage;
- inserts and updates may need to update the index;
- too many indexes make writes heavier;
- the query planner may ignore an index when scanning the table is cheaper;
- an index on the wrong column order may not help the query you actually run.

```sql
CREATE INDEX idx_orders_customer_created
ON orders(customer_id, created_at);
```

This index is naturally useful for queries that begin with `customer_id`:

```sql
SELECT *
FROM orders
WHERE customer_id = 42
  AND created_at >= '2026-01-01';
```

It may be much less useful for a query filtering only by `created_at`, depending on the database, data distribution, and planner.

💡 **The practical lesson:** adding an index is not decorating a schema with a “make fast” button. It is designing a shortcut for a specific access pattern.

## 3. Sync vs Async: One Toll Booth or a Multi-Lane Highway? 🚦

Synchronous code is often explained as “slow,” while asynchronous code is presented as “fast.” That is catchy—but not quite correct.

A better analogy is traffic flow.

### Synchronous execution: one car blocks the lane

Imagine a one-lane toll booth.

The first driver reaches the booth, discovers a payment issue, and spends five minutes looking for cash. Every car behind them waits, even though those drivers have nothing to do with the problem.

```js
const user = getUser()
const orders = getOrders(user.id)
const recommendations = getRecommendations(user.id)
```

Each step waits for the previous one to finish.

That is perfectly reasonable when later work truly depends on earlier work. The problem appears when independent I/O operations are forced into the same queue.

### Asynchronous execution: waiting cars leave the lane open

Now imagine that drivers with payment issues are moved into a side lane. Other cars continue through the toll booth.

```js
const [orders, recommendations] = await Promise.all([
  getOrders(user.id),
  getRecommendations(user.id)
])
```

The work itself is not magically faster. The database query still takes time. The network still has latency.

The improvement is that the program does not waste the waiting period by blocking unrelated work.

This distinction matters because async code has its own traffic accidents:

- too many concurrent requests can overload a database;
- race conditions can update state in the wrong order;
- errors become harder to trace;
- uncontrolled promises can behave like opening 10,000 highway lanes into one tiny parking lot.

💡 **The practical lesson:** async does not remove waiting. It gives your application something useful to do while waiting happens.

## 4. Window Functions: The SQL Skill That Changes How You See Data 

A normal aggregate query compresses many rows into fewer rows.

```sql
SELECT customer_id, SUM(amount) AS total_spent
FROM orders
GROUP BY customer_id;
```

That is useful, but the individual orders disappear from the result.

A **Window Function** lets you calculate across related rows without collapsing them. It is like opening a small analytical window around each row.

```sql
SELECT
  customer_id,
  created_at,
  amount,
  SUM(amount) OVER (
    PARTITION BY customer_id
    ORDER BY created_at
  ) AS running_total
FROM orders;
```

Every order remains visible, but each row can also “see” the relevant history around it.

That unlocks patterns such as:

- ranking products inside each category;
- calculating a running balance;
- comparing an order with the previous order;
- measuring time between user actions;
- finding the first or latest event in each group;
- calculating moving averages.

### Find the previous order without an awkward self-join

```sql
SELECT
  customer_id,
  created_at,
  amount,
  LAG(created_at) OVER (
    PARTITION BY customer_id
    ORDER BY created_at
  ) AS previous_order_at
FROM orders;
```

### Rank products inside each category

```sql
SELECT
  category_id,
  product_name,
  revenue,
  DENSE_RANK() OVER (
    PARTITION BY category_id
    ORDER BY revenue DESC
  ) AS revenue_rank
FROM product_revenue;
```

People sometimes say Window Functions are the line between junior and senior developers. Job titles are obviously more complicated than one SQL feature, but I understand why the phrase exists.

The real shift is not memorizing `ROW_NUMBER()` or `LAG()`. It is learning to think in **relationships between rows**, instead of treating every row as an isolated object.

That mental model shows up everywhere in analytics, reporting, financial systems, event streams, and product metrics.

💡 **The practical lesson:** `GROUP BY` tells you what happened to the group. Window Functions tell you what each row means inside that group.

## 5. Could Grab Predict Demand With Three Lines of SQL? 

Let us be careful here: a production surge-pricing system is not literally three lines of SQL.

A real ride-hailing platform may combine:

- live driver supply;
- current ride requests;
- historical demand by location and time;
- traffic and weather signals;
- event data;
- forecasting models;
- pricing and marketplace constraints.

But SQL can still produce one of the most important signals with surprisingly little code.

```sql
SELECT zone_id, COUNT(*) AS requests
FROM ride_requests
WHERE requested_at >= NOW() - INTERVAL '5 minutes'
GROUP BY zone_id;
```

That query answers a simple but valuable question:

> “How many people requested a ride in each area during the last five minutes?”

Now compare that number with available drivers:

```sql
SELECT
  r.zone_id,
  r.request_count,
  d.available_drivers,
  r.request_count::decimal / NULLIF(d.available_drivers, 0) AS demand_ratio
FROM recent_demand r
JOIN driver_supply d USING (zone_id);
```

If one area has 200 ride requests and only 20 available drivers, the marketplace is under pressure. A pricing or dispatch system can use that ratio as one input when deciding how to rebalance supply and demand.

The interesting part is not the number of SQL lines. It is the realization that everyday product behavior often begins with a small question asked against a large stream of events.

> Where is demand rising faster than supply?

SQL turns that business question into a measurable signal.

💡 **Human insight:** users experience surge pricing as a number on a screen. Engineers see a marketplace trying to prevent 200 people from competing for the same 20 cars.

## 6. E-Commerce Funnels: Finding the Exact Step Where Customers Disappear 

An e-commerce team may say:

> “People are visiting the product page, but sales are low.”

That statement is too vague to act on.

A customer journey usually has several steps:

```text
Product View → Add to Cart → Checkout Started → Purchase
```

The useful question is not simply “How many people bought something?”

It is:

> “At which step do we lose the most people?”

Suppose product events are stored like this:

```text
user_id | event_name        | created_at
--------|-------------------|--------------------
101     | product_view      | 2026-07-15 10:01
101     | add_to_cart       | 2026-07-15 10:03
101     | checkout_started  | 2026-07-15 10:06
102     | product_view      | 2026-07-15 10:08
```

A simplified funnel query might look like this:

```sql
WITH funnel AS (
  SELECT
    user_id,
    MAX((event_name = 'product_view')::int) AS viewed,
    MAX((event_name = 'add_to_cart')::int) AS added,
    MAX((event_name = 'checkout_started')::int) AS checkout,
    MAX((event_name = 'purchase')::int) AS purchased
  FROM events
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY user_id
)
SELECT
  SUM(viewed) AS viewers,
  SUM(added) AS cart_users,
  SUM(checkout) AS checkout_users,
  SUM(purchased) AS buyers
FROM funnel;
```

Imagine the result:

```text
10,000 product viewers
 3,800 added to cart
 3,200 started checkout
   900 completed purchase
```

The biggest leak is not the product page. It is the final payment stage.

That changes the conversation completely.

Instead of redesigning the homepage, the team can investigate:

- unexpected shipping fees;
- payment failures;
- a confusing address form;
- slow checkout performance;
- missing payment methods;
- forced account registration.

💡 **The practical lesson:** good SQL does more than describe the past. It tells a team where to look next.

## 7. Why Is `WHERE` Fast? The Honest Answer Is: Sometimes It Is Not 

Consider this query:

```sql
SELECT *
FROM orders
WHERE customer_id = 42;
```

It is tempting to imagine that `WHERE` somehow jumps directly to matching rows.

But `WHERE` is only the condition. It describes **which rows are allowed through**. It does not decide the physical route used to find them.

The query planner makes that decision.

Depending on the table, indexes, statistics, and expected number of matching rows, the database may choose:

- a sequential scan;
- an index scan;
- a bitmap index scan;
- a partition scan;
- or another execution strategy.

Without an index, the database may inspect rows one by one:

```text
Row 1: customer_id = 8   → reject
Row 2: customer_id = 42  → keep
Row 3: customer_id = 11  → reject
...
```

With a useful index:

```sql
CREATE INDEX idx_orders_customer_id
ON orders(customer_id);
```

The planner can navigate the index to locate references to rows where `customer_id = 42`.

You can inspect the chosen route with:

```sql
EXPLAIN ANALYZE
SELECT *
FROM orders
WHERE customer_id = 42;
```

### Why might the database ignore the index?

Suppose 80% of all orders belong to customer `42`.

Using the index could mean:

1. search the index;
2. retrieve an enormous list of row locations;
3. jump around the table to fetch most of its pages anyway.

At that point, reading the table sequentially may be cheaper.

This is why database performance cannot be reduced to “index good, full scan bad.” The best route depends on selectivity and cost.

💡 **The deeper lesson:** `WHERE` defines the destination. The planner, statistics, and indexes determine how the database gets there.

## 8. WebSockets: Keeping a Phone Call Open Between Frontend and Backend 

Traditional HTTP is like sending letters.

1. The frontend sends a request.
2. The backend returns a response.
3. The conversation ends.

That model works beautifully for many applications.

But imagine building:

- a chat application;
- a live delivery map;
- a trading dashboard;
- multiplayer collaboration;
- warehouse robot monitoring;
- live notifications.

The frontend cannot politely ask the server every millisecond:

> “Anything new?”  
> “Anything new now?”  
> “How about now?”

A WebSocket is more like keeping a phone call open.

Once the connection is established, both sides can send messages whenever they have something to say.

```js
const socket = new WebSocket('wss://example.com/realtime')

socket.addEventListener('message', (event) => {
  const update = JSON.parse(event.data)
  console.log('New server update:', update)
})
```

On the backend, the server can push a message immediately:

```js
socket.send(JSON.stringify({
  type: 'DRIVER_LOCATION_UPDATED',
  driverId: 'driver-42',
  lat: 10.7769,
  lng: 106.7009
}))
```

### Real-time architecture is more than opening a socket

The connection is the easy part. Production systems also need to think about:

- authentication and authorization;
- reconnecting after network loss;
- heartbeats and stale connections;
- message ordering;
- duplicate events;
- horizontal scaling;
- backpressure;
- whether every update truly needs to be real time.

A driver moving on a map may justify frequent updates. A profile picture changing once a month probably does not.

💡 **The practical lesson:** real time is not a visual effect. It is a delivery guarantee with infrastructure costs attached.

## 9. The Pattern Connecting All of These Concepts 

Deadlocks, indexes, async code, Window Functions, funnels, and WebSockets may look like separate topics.

They are all answers to one question:

> “What happens when a simple program meets real scale, real users, and real time?”

At small scale:

- every query feels fast;
- concurrency bugs rarely appear;
- polling seems acceptable;
- data analysis fits inside a few `GROUP BY` queries;
- architecture decisions feel theoretical.

At larger scale, hidden assumptions become visible.

- Two correct transactions can block each other.
- A tiny query can scan a billion rows.
- Waiting for I/O can freeze unrelated work.
- A single row makes sense only in the context of previous rows.
- A conversion problem can hide in one specific funnel step.
- A live interface needs a persistent communication strategy.

This is the part of engineering I find genuinely exciting. The syntax is rarely the hardest piece. The harder skill is building a mental model of what the system is doing when nobody is looking.

## A Few Questions Worth Discussing 💬

- What was the first database performance issue that forced you to learn indexes properly?
- Have you ever fixed a deadlock by changing lock order rather than adding retries?
- Which Window Function made SQL finally “click” for you?
- Where would you choose polling, Server-Sent Events, or WebSockets today?
- Which step in your product funnel currently has the biggest unexplained drop-off?

I would love to hear the real production stories—the ones where the clean architecture diagram met messy user behavior.

## Final Thought

SQL is often introduced as a language for tables.

I think that description is too small.

SQL is one of the ways we ask a running system to explain itself:

- Who is waiting?
- What is slow?
- Where are users leaving?
- Which event happened first?
- Where is demand rising?
- What changed in the last five minutes?

Once you start asking those questions, SQL stops feeling like a collection of commands.

It starts feeling like a way to see the machinery behind the product.

Happy querying. 

Yonnon

---

## Further Reading

- [PostgreSQL: Explicit Locking and Deadlocks](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL: B-Tree Indexes](https://www.postgresql.org/docs/current/btree.html)
- [PostgreSQL: Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [PostgreSQL: Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html)
- [MDN: WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
