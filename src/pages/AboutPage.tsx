import { Link } from "react-router-dom";
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
            A post is an original post, a quote post, or a reply from the last seven days. Reposts
            are not counted. That is the same posts number you see in your own X analytics. Convex
            mentions come from those same posts: the whole word convex in the text, in a long
            post&apos;s full text, or in a shared link that points to convex.dev.
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
            counts link clicks, profile visits, detail expands, and follows. Those private counts
            are only visible to the account owner, so the board cannot read them. Impressions are
            the public impression count on the same posts. The Yappers board ranks by public
            engagement; the Convex mentions board ranks by Convex post count.
          </p>
        </section>
        <section>
          <span className="method-number">04</span>
          <h2>Convex keeps it fresh</h2>
          <p>
            Convex refreshes the board once a day at 8:17 AM Pacific, so a number can be up to a
            day behind live X counts, and everyone gets a new shot at moving up after the next good
            yap. Every active profile is refreshed in the same run, in join order, no matter how
            big the board gets. The seven day window is measured from that run. That run is a{" "}
            <a
              className="text-link"
              href="https://docs.convex.dev/scheduling/cron-jobs"
              target="_blank"
              rel="noreferrer noopener">
              Convex cron job
            </a>
            . After each run the board saves that day&apos;s ranking and keeps the last 7 days, so
            the arrows next to the date show where everyone stood earlier in the week.
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
        {/* Keep in step with the sort rules in convex/profiles.ts. */}
        <section className="method-wide">
          <span className="method-number">07</span>
          <h2>How the ranking works</h2>
          <p>
            <strong>Yappers.</strong> Everyone is ranked by public engagement on their posts from
            the last seven days. A tie goes to the higher impression count, then the most posts,
            then whoever joined the board first. Anyone still waiting on their first X sync sits
            below every row with real numbers.
          </p>
          <p>
            <strong>Convex mentions.</strong> Here the order is the number of posts that mention
            Convex. A tie goes to more impressions on those Convex posts, then more engagement on
            them, then more impressions across all posts. People with zero mentions this week stay
            on the list, faded out, below everyone who posted about Convex.
          </p>
          <p>
            <strong>Groups.</strong> A group board shows only the people in that group, ranked with
            the same rules as the Yappers board. The numbers come from the same daily sync, so your
            engagement matches on every board you appear on. Only your rank changes, since it
            counts from 01 inside each group. An admin can mute someone in one group. That person
            stays listed under a divider with no rank, everyone below moves up a spot, and their
            rank on every other board stays put. Legends leave every ranking and only show up in a
            group when you search for them.
          </p>
        </section>
        <section className="method-wide">
          <span className="method-number">08</span>
          <h2>The weekly top 10</h2>
          <p>
            Every Friday, after the morning refresh, each board&apos;s top 10 for the week is saved
            on the{" "}
            <Link className="text-link" to="/weekly">
              weekly page
            </Link>
            . It is the same ranking the board showed that morning, so it covers the seven days
            before the refresh. Weeks stay up after the daily rankings roll off, and each board
            gets its own card to share on X.
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
