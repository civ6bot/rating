# Configuration of Dotenv file for Civ6Bot

Template for `rating.env` is described below.
```dotenv
TEST_MODE=
TEST_BOT_TOKEN=
BOT_TOKEN=

DATABASE_HOSTNAME=
DATABASE_PORT=
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_NAME=
```

1. `TEST_MODE`: test mode switch. set 1 for test mode or 0 for release mode.
2. `TEST_BOT_TOKEN`: Discord token for test bot (in test mode).
3. `BOT_TOKEN`: Discord token for live bot (release mode).
- You can find additional info about Discord bot tokens [here](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token).
4. `DATABASE_HOSTNAME`: IP Address of outer database.
5. `DATABASE_PORT`: port of outer database.
6. `DATABASE_USER`: username for connection to outer database.
7. `DATABASE_PASSWORD` password for connection to outer database.
8. `DATABASE_NAME`: outer database name.
- Outer database is running on [PostgreSQL](https://www.postgresql.org/).
