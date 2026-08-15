import { usePageTitle } from "../lib/usePageTitle";

export function AboutPage() {
  usePageTitle("About");
  return (
    <div className="editorial-page">
      <header className="editorial-hero">
        <div className="editorial-title">
          <p className="eyebrow">About the board</p>
          <h1>Friends of Convex, just yapping and being cool.</h1>
        </div>
        {/* <p>
          Friends of Convex is a curated Leaderboard Requests to join are reviewed on a rolling
          basis.
        </p> */}
      </header>
      <div className="method-grid">
        <section>
          <span className="method-number">01</span>
          <h2>Friends of Convex</h2>
          <p>
            This is a people-only list for friends who build, teach, share, and make the Convex
            community more fun.
          </p>
        </section>
        <section>
          <span className="method-number">02</span>
          <h2>A week of yaps</h2>
          <p>
            The board looks at original public posts from the last seven days. Replies and reposts
            sit this one out.
          </p>
        </section>
        <section>
          <span className="method-number">03</span>
          <h2>Most yap wins</h2>
          <p>
            The leaderboard adds up public impressions from those posts. It is a friendly
            scoreboard, not a measure of who matters most.
          </p>
        </section>
        <section>
          <span className="method-number">04</span>
          <h2>Convex keeps it fresh</h2>
          <p>
            Convex refreshes the board once a day at 8 AM Pacific, so everyone gets a new shot at
            moving up after the next good yap. That run is a{" "}
            <a
              className="text-link"
              href="https://docs.convex.dev/scheduling/cron-jobs"
              target="_blank"
              rel="noreferrer noopener">
              Convex cron job
            </a>
            .
          </p>
        </section>
        <section>
          <span className="method-number">05</span>
          <h2>Want to join?</h2>
          <p>
            Sign in with X, ask to join, and an admin will review your request. Approved friends
            show up on the next board refresh.
          </p>
        </section>
        <section>
          <span className="method-number">06</span>
          <h2>If you&apos;re here, you&apos;re cool</h2>
          <p>
            That is the whole rule. Thanks for yapping, teaching, building in public, helping other
            devs, and keeping the Convex corner fun.
          </p>
        </section>
      </div>
      <aside className="editorial-note">
        <p className="section-kicker">Keep yapping</p>
        <p>
          Rankings move. Handles change. Good posts keep shipping. This board is a fun snapshot of
          Friends of Convex showing up in public, so share what you know, be kind, and do not take
          the number too seriously.
        </p>
      </aside>
    </div>
  );
}
