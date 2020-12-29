import * as core from "@actions/core";
import { context } from "@actions/github";
import { EventPayloads } from "@octokit/webhooks";
import { HttpClient } from "@actions/http-client";
import {
  CLUBHOUSE_STORY_URL_REGEXP,
  getClubhouseURLFromPullRequest,
  getClubhouseStoryIdFromBranchName,
  getClubhouseStoryById,
  updateClubhouseStoryById,
  getClubhouseIterationInfo,
  getLatestMatchingClubhouseIteration,
} from "./util";

export default async function labeled(): Promise<void> {
  const payload = context.payload as EventPayloads.WebhookPayloadPullRequest;

  // TODO: grab labels. can we tell which label was added in the event?
  // Do this up front because we want to return fast if a PR has no labels
  // configured for Iteration support
  core.debug(`payload: ${JSON.stringify(payload)}`);
  core.debug(`PR labels: ${JSON.stringify(payload.pull_request.labels)}`);
  const githubLabels = (payload.pull_request.labels || []).map(
    (label) => label.name
  );
  core.debug(`githubLabels: ${JSON.stringify(githubLabels)}`);
  const clubhouseIterationInfo = getClubhouseIterationInfo(githubLabels);
  if (!clubhouseIterationInfo) {
    core.debug(`No new label configured for iteration matching. Done!`);
    return;
  }

  const branchName = payload.pull_request.head.ref;
  let storyId = getClubhouseStoryIdFromBranchName(branchName);
  if (storyId) {
    core.debug(`found story ID ${storyId} in branch ${branchName}`);
  }

  // TODO: Does timing work out such that we can expect to have the CH
  // story comment posted already when the label event fires?
  const clubhouseURL = await getClubhouseURLFromPullRequest(payload);
  if (!clubhouseURL) {
    core.setFailed("Clubhouse URL not found!");
    return;
  }

  const match = clubhouseURL.match(CLUBHOUSE_STORY_URL_REGEXP);
  if (match) {
    storyId = match[1];
    core.setOutput("story-id", storyId);
  } else {
    core.debug(`invalid Clubhouse URL: ${clubhouseURL}`);
    return;
  }

  const http = new HttpClient();
  const story = await getClubhouseStoryById(storyId, http);
  if (!story) {
    core.setFailed(`Could not get Clubhouse story ${storyId}`);
    return;
  }

  const clubhouseIteration = await getLatestMatchingClubhouseIteration(
    clubhouseIterationInfo,
    http
  );
  core.debug(`clubhouseIteration: ${JSON.stringify(clubhouseIteration)}`);
  if (clubhouseIteration) {
    await updateClubhouseStoryById(storyId, http, {
      iteration_id:  clubhouseIteration.id,
    });
  } else {
    // TODO: should this really be a failure?
    core.setFailed(`Could not find Clubhouse Iteration for story`);
  }
}