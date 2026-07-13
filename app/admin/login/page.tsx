import { loginAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <article>
      <h1>Beanstalk admin</h1>
      <form action={loginAction}>
        <p>
          <label>
            Password <input type="password" name="password" required />
          </label>
        </p>
        <p>
          <button type="submit">Log in</button>
        </p>
      </form>
      {error ? <p role="alert">Incorrect password.</p> : null}
    </article>
  );
}
