"use client";
import { useState } from "react";
export function ClassroomDemo() {
  const [playback, setPlayback] = useState(0);
  return (
    <div
      className="demo premium-demo"
      aria-label="Animated shared tutoring whiteboard demonstration"
    >
      <div className="pd-top">
        <div className="pd-brand">
          <span className="pd-dot"></span>
          <span>
            LearnTap <b>Live classroom</b>
          </span>
        </div>
        <div className="pd-live">● SESSION PREVIEW</div>
      </div>
      <div className="pd-layout" key={playback}>
        <div className="pd-board">
          <div className="pd-boardtop">
            <div>
              <span className="pd-small">TODAY&apos;S QUESTION</span>
              <strong>Integration by parts</strong>
            </div>
            <div className="pd-avatars">
              <span title="Tutor">T</span>
              <span title="Student">S</span>
            </div>
          </div>
          <div className="pd-paper">
            <div className="pd-rule"></div>
            <div className="pd-equation pd-question">
              ∫ x<sup>2</sup>e<sup>x</sup> dx
            </div>
            <div className="pd-stage pd-stage1">
              <span className="pd-index">01</span>
              <div>
                <span className="pd-hint">Choose the parts</span>
                <div className="pd-math">
                  <em>u</em> = x<sup>2</sup>{" "}
                  <span className="pd-muted">and</span> <em>dv</em> = e
                  <sup>x</sup> dx
                </div>
              </div>
            </div>
            <div className="pd-stage pd-stage2">
              <span className="pd-index">02</span>
              <div>
                <span className="pd-hint">Apply the formula</span>
                <div className="pd-math">
                  = x<sup>2</sup>e<sup>x</sup> − 2∫ xe<sup>x</sup> dx
                </div>
              </div>
            </div>
            <div className="pd-stage pd-stage3">
              <span className="pd-index">03</span>
              <div>
                <span className="pd-hint">Integrate once more</span>
                <div className="pd-math pd-answer">
                  = e<sup>x</sup>(x<sup>2</sup> − 2x + 2) + C <span>✓</span>
                </div>
              </div>
            </div>
            <div className="pd-cursor pd-tutorcursor">
              <svg width="17" height="20" viewBox="0 0 17 20">
                <path
                  d="M2 1 L2 17 L6.5 12.5 L10 19 L13 17 L9.5 10.5 L16 10 Z"
                  fill="#6d4bea"
                  stroke="white"
                  strokeWidth="1.4"
                />
              </svg>
              <span>Tutor</span>
            </div>
            <div className="pd-cursor pd-studentcursor">
              <svg width="17" height="20" viewBox="0 0 17 20">
                <path
                  d="M2 1 L2 17 L6.5 12.5 L10 19 L13 17 L9.5 10.5 L16 10 Z"
                  fill="#0d9fb5"
                  stroke="white"
                  strokeWidth="1.4"
                />
              </svg>
              <span>Student</span>
            </div>
          </div>
        </div>
        <div className="pd-side">
          <div className="pd-video">
            <div className="pd-person">
              <div className="pd-hair"></div>
              <div className="pd-head"></div>
              <div className="pd-body"></div>
            </div>
            <span className="pd-name">Ananya · Tutor</span>
            <div className="pd-wave">
              <i></i>
              <i></i>
              <i></i>
              <i></i>
              <i></i>
            </div>
          </div>
          <div className="pd-chat">
            <div className="pd-chat-label">LIVE CONVERSATION</div>
            <div className="pd-bubble pd-studentmsg">
              Why do we integrate twice?
            </div>
            <div className="pd-bubble pd-tutormsg">
              Great question! The power of x reduces each time.
            </div>
          </div>
        </div>
      </div>
      <div className="pd-bottom">
        <div className="pd-tools">
          <span>⌁</span>
          <span>✎</span>
          <span>◉</span>
        </div>
        <span>Illustrative demo · Not a real session</span>
        <button
          className="pd-replay"
          type="button"
          aria-label="Replay animation"
          onClick={() => setPlayback((value) => value + 1)}
        >
          ↻ Replay
        </button>
      </div>
    </div>
  );
}
