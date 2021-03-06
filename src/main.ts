import * as core from "@actions/core";
import { context } from "@actions/github";
import { EventPayloads } from "@octokit/webhooks";
import opened from "./opened";
import closed from "./closed";
import labeled from "./labeled";
import { shouldProcessPullRequestForUser } from "./util";

async function run(): Promise<void> {
  if (context.eventName !== "pull_request") {
    core.setFailed("This action only works with `pull_request` events");
    return;
  }

  const payload = context.payload as EventPayloads.WebhookPayloadPullRequest;
  const author = payload.pull_request.user.login;

  if (!shouldProcessPullRequestForUser(author)) return;

  switch (payload.action) {
    case "opened":
      return opened();
    case "closed":
      return closed();
    case "labeled":
      return labeled();
    default:
      core.setFailed(
        "This action only works with the `opened`, `closed` and `labeled` actions for `pull_request` events"
      );
      return;
  }
}

run();
