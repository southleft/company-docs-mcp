---
source: https://canvas.workday.com/guidelines/content/ui-text/error-and-alert-messages
title: Error and Alert Messages | Workday Canvas Design System
date: 2025-08-09T14:26:51.291Z
---
# Error and Alert Messages

Errors are “hard-stops,” or messages that prevent a user from moving forward in their workflow.
Alerts, or warnings, are “soft-stops” that convey information a user needs to know to prevent an
error, but don’t stop the user from continuing their workflow. In both cases, it’s important to make
the content of these messages clear, concise, and useful.

## General Guidelines

- Write like a human speaks. How would you phrase the error if you were speaking to a friend? Read
your error out loud to test how natural your wording sounds.
- Try to tell the user what they need to do to fix the error. Only provide a solution when it is the
exact solution that will solve the issue.
- Let the user know what caused the error if that hasn’t been addressed by your fix. Try to balance
providing specific information with keeping the message concise.
- Be consistent across messages in the product. Errors of similar types should have similar
messages.

## Active Voice

Use active voice when writing error messages. You may use passive voice to avoid:

- Assigning fault to a user or 3rd party vendor.
- Negatively reinforcing the Workday brand.

###### Do

- There was an issue retrieving your information.

###### Don’t

- Excellent Enterprise failed to retrieve your information.

However, in the majority of cases, you can keep messages positive, avoid blame, and stay in active
voice by telling users what they can do to recover.

## Writing Tips

- Use short, declarative, complete sentences in present tense.
- Use contractions to make the language more natural and casual.
- End full sentences with periods.
- Don't use special characters such as &, /, quotation marks, and so on. However, you can use tildas
(~) for custom labels and brackets ([ ]) for variables.
- Use second person. (“You don’t have permission to access this document.”)
- No need to segue or introduce the error. Don’t use “To fix this error . . .”
- Avoid jargon and technical language. Don’t use value when you mean number.
- Don’t use “please” or “sorry,” but try to keep the tone of the message polite and conversational.
- Don't label any messages with the words “Error” or “Alert.” This information is automatically
added to the beginning of error and alert messages.

## Referring to Field Labels

Don’t include the field label associated with the error in the text of the message. Workday
automatically includes a subheading with the corresponding field label hyperlinked above the error
message text.

If you directly refer to another UI element (which Workday doesn’t include as a subheading) ensure
the name exactly matches what’s in the UI, including capitalization. However, if you refer to UI
elements generally, use lower case.

## Considerations for Translations

When including variables, try to place them at the end of a message after a colon for ease in
translations. Include a noun that will help identify the variable somewhere in the message.

###### Do

- Enter a valid user. This user isn’t valid: [variable].

Try to limit variables and custom labels to only 1 or 2 per message, if possible. Overuse can lead
to confusing messages.

###### Do

- Select a remit-from ~sponsor~ that isn't already in use for at least 1 other ~sponsor~.

###### Don’t

- You cannot select a remit-from ~sponsor~ for this ~sponsor~ because it is the remit-from ~sponsor~
for at least 1 other ~sponsor~.

## More Error Message Examples