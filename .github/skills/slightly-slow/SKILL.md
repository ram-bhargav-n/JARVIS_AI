---
name: slightly-slow
description: 'Diagnose and fix “it feels slightly slow” issues in local apps, APIs, or workflows. Use when the app is laggy, requests take too long, the UI feels sluggish, or the user says it is running slowly and you need a quick root-cause triage workflow.'
argument-hint: 'What feels slow? What have you already checked?'
user-invocable: true
disable-model-invocation: false
---

# Slightly Slow Debugging

## When to Use
- The app works, but feels laggy or under-responsive.
- A request takes longer than expected but does not fail outright.
- A local server or browser UI feels a bit sluggish.
- You need a fast, repeatable path to find the cause without guessing.
- The user says: “it’s slightly slow” or “this feels laggy.”

## Goal
Find the bottleneck quickly, fix the smallest root cause, and verify the improvement with the same real-world scenario.

## Procedure

### 1. Reproduce and define the slowdown
- Confirm the exact trigger: page load, chat request, model call, file read, or repeated UI action.
- Measure the current behavior in plain terms:
  - “Page loads in 3 seconds instead of 1”
  - “Chat reply takes 8 seconds”
  - “Buttons feel delayed after interactions”
- Capture whether the problem is:
  - client-side delay
  - backend/API delay
  - model/provider latency
  - network or device slowness

### 2. Narrow the layer
Check the system in this order:
1. Browser or frontend
2. API/server response time
3. External AI or service call
4. Database, file system, or local resources
5. Background loops or repeated work

For this project, look at:
- the FastAPI routes in `app.py`
- the browser code in `static/assistant.js`
- model access through Ollama or the configured provider
- request history size and conversation payload length

### 3. Check the obvious causes first
Look for the common “slightly slow” issues:
- repeated or unnecessary API calls
- large prompt/history payloads being sent every turn
- unbounded loops, polling, or excessive re-renders
- slow model startup or first call after idle
- blocking operations on the main thread
- high token generation settings or too-large output limits

For this app specifically, the biggest suspects are:
- large conversation history sent to the model
- slow local Ollama model loading or generation time
- chat UI repeatedly re-rendering or requesting data
- missing profiling around `/api/chat`

### 4. Measure before changing anything
Collect one or two concrete signals:
- request timing logs
- browser devtools network waterfall
- server response times
- CPU or memory spikes
- size of the payload sent to the model

Keep the evidence factual. Do not fix a hunch without a measurement.

### 5. Apply one targeted fix
Prefer the smallest change that addresses the actual bottleneck:
- trim excess history or input size
- reduce token generation limits
- avoid duplicate calls
- cache stable values
- defer nonessential work
- reduce prompt size or repeated processing

For a local AI app, a realistic first fix is often one of these:
- shorten or cap conversation history
- lower generation settings such as `num_predict`
- avoid re-running expensive work on every render
- reduce frontend polling or redundant refreshes

### 6. Validate the same workflow
After the change, retest the same path that was slow:
- send the same prompt again
- repeat the action in the same browser flow
- compare before/after timing
- confirm that the fix did not change correctness

Success means the app is measurably better on the same real workload.

### 7. Record the root cause and fix
Write down:
- what was slow
- what layer caused it
- what change fixed it
- how you verified the improvement

This prevents the same “slightly slow” issue from returning later.

## Completion Checklist
Before stopping, confirm all of the following:
- [ ] The slow path was reproduced.
- [ ] The bottleneck was identified to a specific layer.
- [ ] One small root-cause fix was applied.
- [ ] The same workflow was re-tested.
- [ ] The improvement was measured, not guessed.
- [ ] The cause and fix were documented.

## Example prompts
- “The app is a little slow—what should I check first?”
- “Chat replies feel sluggish; help me profile the bottleneck.”
- “The page loads fine but requests lag; where is the delay?”
- “This local assistant is slightly slow—what are the most likely causes?”
- “I think the model call is the issue; how do I confirm and fix it?”

## Good default questions
- What is slow: startup, page load, chat response, or repeated actions?
- Are you seeing it on the browser, server, or model layer?
- What changed recently before the slowdown started?
- What is the exact trigger and how often does it happen?
- Have you measured timing or only suspected it?

## Anti-patterns to avoid
- Guessing without reproducing the slow path
- Fixing the UI when the delay is in the model backend
- Adding more complexity before measuring the bottleneck
- Using broad rewrites instead of one focused optimization
- Treating all slowness as a single issue when it is layered

## Best practice for this repo
For this project, first check:
- conversation length being sent to Ollama
- model generation settings in `call_ollama()`
- API route latency on `/api/chat`
- browser-side rendering or repeated requests in `static/assistant.js`
- whether the local Ollama model is cold-starting or already loaded

The goal is not to make the app “fast enough” by accident; it is to identify the real bottleneck and remove it with a measured, minimal fix.
