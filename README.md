# Discord Bouncer Bot
Bot that automatically bans suspicious accounts (mostly spambots). Lets false positives verify themselves using Google's ReCaptcha.

![Discord Bouncer Bot preview](./preview.png)

# Usage
Install dependencies using `npm install`, customise `config.js`, and run
the bot using `npm start`.

# Commands

```markdown
Help
----
Commands used to show this message:

# !bb
# !bb help


Suspect list
------------
The bot maintains a list of suspects for each server. This list can be
used to kick or ban suspicious members. By default, the list is empty. 

# !bb prepare [threshold=3]
→ Initialises the list of suspects based on the list of current server
  members. Suspects with score less than the threshold are ignored.
  
# !bb spare <indices>
→ Removes users with specified indices from the suspect list. The
  indices have to be separated with commas.
  
# !bb kick
→ Kicks all of the users on the suspect list.

# !bb ban
→ Bans all of the users on the suspect list, sending each one a message
  with a verification link.
  
# !bb list
→ Shows the current list of suspects, indicating the score of each suspect.


Util
----

# !bb report-here
→ Makes the bot report all of its automatic actions (mostly bans and
  unbans) to the current channel.

# !bb no-report
→ Disables automatic reporting.
```