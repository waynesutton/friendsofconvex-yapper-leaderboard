import Twitter, { type TwitterProfile } from "@auth/core/providers/twitter";
import { convexAuth } from "@convex-dev/auth/server";

const clientId = process.env.AUTH_TWITTER_ID;
const clientSecret = process.env.AUTH_TWITTER_SECRET;

const providers =
  clientId && clientSecret
    ? [
        Twitter({
          clientId,
          clientSecret,
          authorization: {
            url: "https://x.com/i/oauth2/authorize",
            params: { scope: "users.read tweet.read" },
          },
          userinfo:
            "https://api.x.com/2/users/me?user.fields=description,profile_image_url",
          profile({ data }: TwitterProfile) {
            return {
              id: data.id,
              name: data.name,
              image: data.profile_image_url,
              xUserId: data.id,
              xUsername: data.username,
              xDescription: data.description,
            };
          },
        }),
      ]
    : [];

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
});
