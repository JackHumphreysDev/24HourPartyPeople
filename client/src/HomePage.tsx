import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <section className="home-hero" aria-labelledby="home-heading">
      <p className="eyebrow">Established 2016</p>
      <h2 id="home-heading">Football, friends, and the full story.</h2>
      <p>
        The home of 24 Hour Party People—bringing the squad, statistics,
        fixtures, results, and club history together.
      </p>
      <Link className="primary-link" to="/players">
        Meet the squad
      </Link>
    </section>
  );
}
