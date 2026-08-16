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
          <h2>What counts as a post</h2>
          <p>
            A post is an original post or a quote post from the last seven days. Replies and
            reposts are not counted, so the Posts number is smaller than your total X activity. If
            you spend the week in the replies, the board will show a low number and still be
            correct.
          </p>
        </section>
        <section>
          <span className="method-number">03</span>
          <h2>What counts as engagement</h2>
          <p>
            Engagements are likes plus reposts plus replies plus quotes plus bookmarks on those
            posts, read from the{" "}
            <a
              className="text-link"
              href="https://docs.x.com/x-api/fundamentals/metrics"
              target="_blank"
              rel="noreferrer noopener">
              X API public metrics
            </a>
            . That is a narrower number than the engagements figure in X analytics, which also
            counts link clicks, profile visits, detail expands, and follows. Impressions are the
            public impression count on the same posts.
          </p>
        </section>
        <section>
          <span className="method-number">04</span>
          <h2>Convex keeps it fresh</h2>
          <p>
            Convex refreshes the board once a day at 8:17 AM Pacific, so a number can be up to a
            day behind live X counts, and everyone gets a new shot at moving up after the next good
            yap. The seven day window is measured from that run. That run is a{" "}
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
        <p>
          Every number here comes from the public X API, counted with the rules above and nothing
          else. If a number looks wrong for your account, it is almost always a definition gap, so
          check the tooltip on the column header first, then tell us and we will fix the
          measurement.
        </p>
      </aside>
    </div>
  );
}
