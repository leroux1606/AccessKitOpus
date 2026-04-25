# What do "Integrations" do?

Imagine AccessKit is a friendly inspector who checks if websites are easy for everyone to use — including people who can't see well, can't use a mouse, or use a screen reader.

Most of the time you visit AccessKit's website, look at the inspector's report, and read what they found. That's the normal way.

**Integrations are different ways AccessKit can talk to your other tools — without you having to log in and look.**

There are four of them on the Integrations page. Here's what each one does, in plain words.

---

## 1. The REST API — "Asking AccessKit questions through a robot"

Imagine AccessKit lives in a giant library. Normally you walk in, find the book yourself, and read it. That's the website.

The **REST API** is a magic intercom. You shout into it: *"What's the score for my website?"* and a robot inside the library shouts back: *"Eighty-eight!"*

You don't go in. Your computer (or another app you've built) does the asking. AccessKit answers in a tidy little package called JSON — a way of writing information that other computers easily understand.

**Why is this useful?**
Maybe you have your own dashboard at work where you show lots of numbers from different places. With the API, you can put AccessKit's score on your dashboard automatically. No copy-pasting, no opening tabs. The number just appears.

**How do you get in?**
You need a special password called an **API key**. It's like a library card. Without one, the robot won't talk to you. With one, it answers your questions all day.

You make your key on the **Settings → API Keys** page. Keep it secret — anyone with the key can ask questions as if they were you.

---

## 2. Webhooks — "AccessKit calling YOU when something happens"

The API is you asking AccessKit. **Webhooks are the opposite — AccessKit calling you.**

Imagine you're waiting for a pizza. You could call the restaurant every five minutes and ask *"is my pizza ready yet?"* — that's like the API. Annoying, slow, you have to keep asking.

A webhook is like giving the restaurant your phone number and saying *"call me when it's done."* They ring you. You don't have to do anything until they do.

**What does AccessKit call you about?**
- *"A scan just finished!"* (`SCAN_COMPLETED`)
- *"Uh oh — we found really serious problems."* (`CRITICAL_ISSUES_FOUND`)
- *"Your website's score just dropped."* (`SCORE_DROPPED`)

**Why is this useful?**
You can wire it up so that whenever AccessKit calls, your team's chat gets a message. Or your phone buzzes. Or it writes itself into your project tracker. You stop missing problems because you're not checking — AccessKit tells you the moment something happens.

**How does AccessKit prove it's really them calling?**
Every webhook has a secret handshake — a long string only you and AccessKit know. AccessKit attaches a tiny stamp made from that secret to every message. Your computer checks the stamp. If it matches, the message is real. If it doesn't, it's a fake — ignore it. This stops bad people from pretending to be AccessKit.

---

## 3. GitHub Actions — "The robot guard at the door of your code"

Developers (the people who build websites) keep all their work in a place called **GitHub**. Whenever they want to change something on a website, they have to check the change in. It's a bit like leaving homework in a teacher's tray.

A **GitHub Action** is a robot helper that wakes up whenever someone leaves homework. It can do anything you teach it.

You can teach the GitHub Action robot to call AccessKit and say: *"Hey, I'm about to put new code on the website. Can you check it for accessibility problems first?"*

If AccessKit says *"yes, this is fine"* — the change goes through.
If AccessKit says *"no, this would make things worse for blind people"* — the robot stops the change. The developer has to fix it before it can go live.

**Why is this useful?**
It catches accessibility mistakes **before** they reach real users. Like a spell-checker, but for "is this website kind to everyone?" The whole team gets reminded automatically — no one has to remember to check.

**How do you set it up?**
You don't install anything from AccessKit. You write a small instruction file (called a workflow) and put it in your project. There's a copy-paste-ready example on the AccessKit Integrations page — you grab it, paste it, and add your API key. The robot does the rest.

---

## 4. GitLab and Bitbucket — "Same robot, different building"

GitHub isn't the only place developers keep their code. There are two other big ones: **GitLab** and **Bitbucket**.

The good news: the AccessKit robot works in all three. It's the same idea — a little instruction file you put in your project, telling the robot to call AccessKit before any code change goes live.

If your team uses GitLab instead of GitHub, you write a slightly different instruction file (`.gitlab-ci.yml` instead of `.github/workflows/something.yml`). Bitbucket has its own version too. AccessKit doesn't care which one you use — the API answers all of them the same way.

---

## A simple summary

| Integration | Who's asking? | When does it happen? |
|---|---|---|
| **REST API** | You ask AccessKit | Whenever you want |
| **Webhooks** | AccessKit tells you | When something happens |
| **GitHub Actions** | A robot asks AccessKit | When code changes |
| **GitLab / Bitbucket** | A different robot asks AccessKit | When code changes |

The first two are about **getting information**.
The last two are about **stopping bad changes before they go live**.

That's it. That's all integrations do — they let AccessKit talk to your other tools, so you don't have to keep logging in and checking by hand.
