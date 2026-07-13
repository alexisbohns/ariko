import { getPublicDataset } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const data = await getPublicDataset();
  const molecules = data.getMolecules();
  const standalone = data.standaloneAtoms();

  return (
    <article>
      <h1>Directory</h1>

      {molecules.map((molecule) => {
        const atoms = data.atomsForMolecule(molecule.slug);
        return (
          <section key={molecule.slug}>
            <h2>{molecule.name}</h2>
            <ul>
              {atoms.map((atom) => (
                <li key={atom.slug}>
                  <a href={`/atom/${atom.slug}`}>{atom.name}</a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {standalone.length > 0 && (
        <section>
          <h2>Standalone</h2>
          <ul>
            {standalone.map((atom) => (
              <li key={atom.slug}>
                <a href={`/atom/${atom.slug}`}>{atom.name}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
