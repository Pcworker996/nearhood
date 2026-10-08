// Exact supplied Figma SVGs, with their intrinsic dimensions preserved.
const dimensions = {
  warning: 19,
  activity: 19,
  locate: 20,
  toggle: 20,
  chevron: 20,
  info: 16,
  map: 21,
  discover: 21,
  contribute: 22,
  profile: 18,
  "preview-chevron": 18,
  location: 18,
  contributors: 18,
  uncertainty: 19,
  back: 21,
};
export function FigmaIcon({ name }: { name: keyof typeof dimensions }) {
  const size = dimensions[name];
  // next/image is unnecessary for small local vectors with fixed intrinsic geometry.
  return <img src={`/figma/${name}.svg`} alt="" width={size} height={size} />;
}
