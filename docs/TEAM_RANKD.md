# Team RANKD Foundation

Team RANKD is separate from Core ELO.

- Core ELO club registration is shareable and only helps identify games.
- Team RANKD club ownership is protected and requires staff approval.
- An approved Team RANKD club begins at `2500` Team ELO by default.
- The Team ELO starting rating can be tuned with `TEAM_ELO_STARTING_RATING`.

## Initial Commands

```text
/teamapply club:<registered club name, alias, or ID> notes:<optional>
/teampending
/teamapprove application_id:<number>
/teamdeny application_id:<number> reason:<text>
/teaminfo team:<name or club ID>
```

## Approval Flow

1. The applicant must first attach themselves to the club through Core ELO registration.
2. `/teamapply` creates a pending ownership request.
3. A club ID may only have one pending application.
4. Staff approves or denies the request.
5. Approval permanently reserves the Team RANKD club ID to that owner and assigns the existing
   `Captain` and `RANKD Teams` Discord roles.

Players can complete the same flow from `/team-rankd` on the RANKD website. New applications and
staff decisions are also posted to the `#team-approvals` Discord channel. Signed-in Discord server
administrators can review pending applications directly on the website.

## Next Team RANKD Systems

- Captain-managed roster invitations and removals
- Assistant Captain permissions
- Team challenge and scheduling flow
- Team match confirmation
- CHELHead result matching for approved Team RANKD clubs
- Team ELO match history, leaderboard, and website profiles
