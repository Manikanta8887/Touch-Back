import { test, describe } from "node:test";
import assert from "node:assert/strict";
import streamStore from "../utils/streamStore.js";

describe("StreamStore Unit Tests", () => {
  const testStreamId = "streamer-test-123";

  test("should set, retrieve and remove a live stream", () => {
    const dummyStream = {
      streamerId: testStreamId,
      streamTitle: "Test Gaming Stream",
      startTime: new Date(),
      viewers: 0,
      chatMessages: [],
    };

    streamStore.setStream(testStreamId, dummyStream);
    const retrieved = streamStore.getStream(testStreamId);
    assert.ok(retrieved, "Stream should be found in store");
    assert.equal(retrieved.streamTitle, "Test Gaming Stream");

    const all = streamStore.getAllStreams();
    assert.ok(all.some((s) => s.streamerId === testStreamId));

    streamStore.removeStream(testStreamId);
    assert.equal(streamStore.getStream(testStreamId), null, "Stream should be removed");
  });

  test("should clamp viewer count so it never drops below 0", () => {
    const streamId = "viewer-clamp-test";
    streamStore.setStream(streamId, { streamerId: streamId, viewers: 1 });

    const dec1 = streamStore.updateViewerCount(streamId, -1);
    assert.equal(dec1, 0, "Viewer count should reach 0");

    const dec2 = streamStore.updateViewerCount(streamId, -1);
    assert.equal(dec2, 0, "Viewer count must never be negative (clamped at 0)");

    streamStore.removeStream(streamId);
  });

  test("should cap chat messages at 200 items to prevent unbounded memory growth", () => {
    const streamId = "chat-cap-test";
    streamStore.setStream(streamId, { streamerId: streamId, chatMessages: [] });

    for (let i = 1; i <= 250; i++) {
      streamStore.addChatMessage(streamId, {
        sender: `User${i}`,
        message: `Hello message ${i}`,
        timestamp: new Date(),
      });
    }

    const stream = streamStore.getStream(streamId);
    assert.equal(stream.chatMessages.length, 200, "Chat messages must be capped at 200");
    assert.equal(stream.chatMessages[stream.chatMessages.length - 1].sender, "User250");
    assert.equal(stream.chatMessages[0].sender, "User51");

    streamStore.removeStream(streamId);
  });
});

