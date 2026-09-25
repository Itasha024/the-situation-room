import { test } from "node:test";
import assert from "node:assert/strict";
import { keeps, mediaCandidate, tgMedia, tooLong, xMedia } from "./media.ts";

test("an X post's video: the ~640 mp4, its still and length; else its first photo", () => {
  const v = xMedia(
    {
      all: [
        { type: "photo", url: "https://pbs.twimg.com/media/A.jpg?name=orig" },
        {
          type: "video",
          url: "https://video.twimg.com/ext_tw_video/1/pu/vid/1280x720/full.mp4",
          thumbnail_url: "https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/t.jpg",
          duration: 31.4,
          width: 1280,
          height: 720,
          formats: [
            { url: "https://video.twimg.com/x/pl.m3u8", container: "m3u8" },
            { url: "https://video.twimg.com/x/320.mp4", container: "mp4", bitrate: 256000 },
            { url: "https://video.twimg.com/x/1280.mp4", container: "mp4", bitrate: 2176000 },
            { url: "https://video.twimg.com/x/640.mp4", container: "mp4", bitrate: 832000 },
          ],
        },
      ],
    },
    "https://x.com/Yah_Saree/status/1",
  );
  assert.deepEqual(v, {
    kind: "video",
    from: "x",
    post: "https://x.com/Yah_Saree/status/1",
    thumb: "https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/t.jpg",
    src: "https://video.twimg.com/x/640.mp4",
    duration: 31,
    w: 1280,
    h: 720,
  });
  const p = xMedia({ all: [{ type: "photo", url: "https://pbs.twimg.com/media/HS-eHnkXcAARnwp.jpg?name=orig", width: 610, height: 349 }] }, "https://x.com/war_cube/status/2");
  assert.equal(p?.kind, "photo");
  assert.equal(p?.thumb, "https://pbs.twimg.com/media/HS-eHnkXcAARnwp.jpg?name=medium");
  assert.equal(xMedia(undefined, "https://x.com/a/status/3"), undefined);
});

test("a Telegram post's video: its still, its length and Telegram's own player", () => {
  const block = `<a class="tgme_widget_message_video_player not_supported js-message_video_player" href="https://t.me/army21ye/3756"><i class="tgme_widget_message_video_thumb" style="background-image:url('https://cdn4.telesco.pe/file/abc')"></i><time class="message_video_duration js-message_video_duration">1:16</time></a>`;
  assert.deepEqual(tgMedia(block, "https://t.me/army21ye/3756"), {
    kind: "video",
    from: "tg",
    post: "https://t.me/army21ye/3756",
    thumb: "https://cdn4.telesco.pe/file/abc",
    embed: "https://t.me/army21ye/3756?embed=1&mode=tme",
    duration: 76,
  });
  const photo = `<a class="tgme_widget_message_photo_wrap blured js-message_photo" style="width:200px;background-image:url('https://cdn4.telesco.pe/file/p.jpg')" href="https://t.me/army21ye/3765?single">`;
  assert.deepEqual(tgMedia(photo, "https://t.me/army21ye/3765"), { kind: "photo", from: "tg", post: "https://t.me/army21ye/3765", thumb: "https://cdn4.telesco.pe/file/p.jpg" });
  assert.equal(tgMedia(`<div class="tgme_widget_message_text">نص فقط</div>`, "https://t.me/a/1"), undefined);
});

test("a Telegram post's own file and shape, as t.me/s gives them (Ali Bk, 25 Sep)", () => {
  const video = `<a class="tgme_widget_message_video_player js-message_video_player" href="https://t.me/Alibk3/37041"><i class="tgme_widget_message_video_thumb" style="background-image:url('https://cdn4.telesco.pe/file/t.jpg')"></i>
<div class="tgme_widget_message_video_wrap" style="width:624px;padding-top:67.307692307692%">
  <video src="https://cdn4.telesco.pe/file/2ccd834ef9.mp4?token=A&amp;b=1" class="tgme_widget_message_video js-message_video" width="100%" height="100%"></video>
</div><time class="message_video_duration js-message_video_duration">0:03</time>`;
  const v = tgMedia(video, "https://t.me/Alibk3/37041");
  assert.equal(v?.src, "https://cdn4.telesco.pe/file/2ccd834ef9.mp4?token=A&b=1");
  assert.equal(v?.w, 624);
  assert.equal(v?.h, 420);
  assert.equal(v?.duration, 3);
  const photo = `<a class="tgme_widget_message_photo_wrap 5310288489968508240" href="https://t.me/Alibk3/37029" style="width:780px;background-image:url('https://cdn4.telesco.pe/file/p.jpg')">
  <div class="tgme_widget_message_photo" style="padding-top:102.5641025641%"></div></a>`;
  const p = tgMedia(photo, "https://t.me/Alibk3/37029");
  assert.deepEqual([p?.kind, p?.w, p?.h], ["photo", 780, 800]);
});

test("which cards may show their post's media", () => {
  const strike = { type: "strike" as const, summary: "Houthi missile hits Jizan", text: "" };
  assert.equal(mediaCandidate(strike, "صاروخ على جيزان"), true);
  assert.equal(mediaCandidate({ type: "statement", summary: "Armed Forces spokesperson announces strikes on Riyadh", text: "" }, "شاهد | كلمة المتحدث"), false);
  assert.equal(mediaCandidate({ type: "statement", summary: "Governor calls for calm", text: "" }, "المحافظ يدعو للتهدئة"), false);
  assert.equal(mediaCandidate({ type: "diplomacy", summary: "Foreign minister meets Omani envoy", text: "" }, "شاهد | لحظة اللقاء"), false);
  assert.equal(mediaCandidate({ type: "combat", summary: "Clashes in Hays", text: "" }, "صورة أرشيفية من جبهة حيس"), false);
  assert.equal(mediaCandidate({ type: "economy", summary: "Control map of the west coast fronts", text: "" }, "frontline map, 25 Sep"), true);
});

test("the look keeps the event, never what is graphic or a portrait", () => {
  const strike = { type: "strike" as const, summary: "Houthi missile hits Jizan" };
  assert.equal(keeps({ cls: "strike", graphic: false }, strike), true);
  assert.equal(keeps({ cls: "launch", graphic: false }, strike), true);
  assert.equal(keeps({ cls: "strike", graphic: true }, strike), false);
  assert.equal(keeps({ cls: "portrait", graphic: false }, strike), false);
  assert.equal(keeps({ cls: "logo", graphic: false }, strike), false);
  assert.equal(keeps({ cls: "speech", graphic: false }, strike), false);
  assert.equal(keeps({ cls: "speech", graphic: false }, { type: "statement", summary: "Houthi leader: attacks will continue" }), false);
  assert.equal(keeps({ cls: "interview", graphic: false }, strike), false);
  assert.equal(keeps({ cls: "hospital", graphic: false }, strike), false);
});

test("a video over a minute and a half is a TV package, not the moment", () => {
  assert.equal(tooLong({ kind: "video", duration: 183 }), true);
  assert.equal(tooLong({ kind: "video", duration: 40 }), false);
  assert.equal(tooLong({ kind: "photo" }), false);
});
