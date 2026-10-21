# HR event producer

A Python simulator of an HR system. It streams employee events (hires, salary changes, promotions, transfers, name changes and leavers) to a **Fabric Eventstream** over the Event Hubs protocol.

It is source 2 in the [streaming architecture](../../docs/streaming-architecture.png). The apply notebook (the next step) lands these events in the app's SQL database, and the existing CDC pipeline takes over from there.

## Payload

The producer sends one JSON message per event. The partition key is the `EmployeeID`, so the events for one employee stay in order.

```json
{
  "event_id": "21c4244f-832c-4893-82df-caa3905a92aa",
  "event_type": "employee.created",
  "event_time": "2026-10-21T07:09:07.705Z",
  "source": "hr-feed-simulator",
  "schema_version": 1,
  "change": "new_hire",
  "employee": {
    "EmployeeID": 900001,
    "FullName": "Arjun Patel",
    "Email": "arjun.patel.900001@example.com",
    "Salary": 1012000.0,
    "JoiningDate": "2026-10-27",
    "Department": "Analytics",
    "JobTitle": "Data Analyst"
  }
}
```

| Field | Meaning |
| --- | --- |
| `event_id` | Unique per event. The apply step uses it to skip events it has already applied. |
| `event_type` | `employee.created`, `employee.updated` or `employee.deleted`. A delete carries the employee's last known state. |
| `event_time` | UTC time, strictly increasing per producer run. For each employee, the newest event wins. |
| `change` | Why the event happened: `new_hire`, `salary_change`, `promotion`, `transfer`, `name_change` or `leaver`. Test events start with `test_`, or are `late_arrival`. |
| `employee` | Business keys only. `Department` and `JobTitle` are names that already exist in the app; salaries are in INR. |

Stream employees use **EmployeeIDs from 900001 upwards**, so they never clash with employees people create in the app. Emails include the ID, so they stay unique.

## 1. Create the Eventstream source

1. In the Fabric workspace, create an **Eventstream**, for example `es_employee_events`.
2. Choose **Add source**, then **Custom endpoint**, give it a name such as `hr-feed`, and **Publish**.
3. Select the custom endpoint node. In the details pane, open the **Event Hub** tab, then **Keys**, and copy **Connection string–primary key**. It ends with `;EntityPath=...`.

## 2. Configure and run

```bash
cd data-platform/streaming/producer
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Paste the connection string into `.env` as `EVENTSTREAM_CONNECTION_STRING`. The `.env` file is git-ignored, so don't commit it or paste the key into chat.

```bash
.venv/bin/python producer.py --dry-run --count 5
```

```bash
.venv/bin/python producer.py --rate 1 --duration 300
```

The first command prints sample events and sends nothing. The second streams one event per second for five minutes. Press Ctrl+C to stop early. Watch **Data preview** on the Eventstream; events should appear within seconds.

| Option | Default | What it does |
| --- | --- | --- |
| `--rate` | 1 | Events per second. Values below 1 are allowed, for example `0.2` for one event every 5 seconds. |
| `--count` / `--duration` | none | Stop after N events or N seconds. With neither, it runs until Ctrl+C. |
| `--bad-rate` | 0 | Share of invalid events: an unknown department, a missing email, a negative salary, an impossible date or an unknown event type. |
| `--dup-rate` | 0 | Share of events sent again with the same `event_id`, to test idempotency. |
| `--late-rate` | 0 | Share of updates that arrive older than the latest event for that employee, with `Salary: 1.0`, to test ordering. |
| `--seed` | none | Makes a run repeatable. |
| `--reset` | off | Forgets the simulated HR state and restarts IDs at 900001. |

## State

The simulated HR system remembers who it has hired in `.state/hr_feed_state.json`. Updates and leavers therefore always refer to employees it created earlier, even across restarts. The state is saved only after a send succeeds; a failed send rolls it back. Dry runs never save it.

This file is the simulator's own memory, not the app's data. Use `--reset` only together with clearing the stream employees from the app, or new hires will reuse IDs that the app already holds.
