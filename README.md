# Alternative-group-card

Below you can find an alternative way to get group control.
Additional custom cards are required from HACS: "stack-in-card" to combine multiple cards into 1, "mushroom" for layout and templating and "card_mod" to make it all look pretty.

<img width="1359" height="339" alt="image" src="https://github.com/user-attachments/assets/34095eb2-0ee4-476d-a119-bccf67355a8f" />

Pincode is optional, when set it's mandetory to enter before action is executed.

```
type: custom:lovelace-galaxy-compact
name: Alarm
entity: sensor.group_5b0438_a1_state
base_topic: galaxy
allow_part: true
allow_night: false
allow_force: true
code: ""
```
