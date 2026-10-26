# Paper of the Year

**<https://matmat202.github.io/paper-of-the-year/>**

Stanford's most-cited paper for every year since 1900, from [OpenAlex](https://openalex.org/).
Hotelling's *Economics of Exhaustible Resources* (1931), Bloch's *Nuclear Induction* (1946),
Diffie and Hellman (1976), Bandura's self-efficacy (1977), Efron's bootstrap (1979), Brin
and Page (1998, a runner-up), ImageNet (2015). Filter by field, search titles and authors,
and open each year's runners-up. Stanford authors are in bold.

## How a year's paper is chosen

Every work in OpenAlex with an author affiliated with Stanford or a child institution
(Stanford Medicine), that is an article, review, book or chapter and not retracted,
sorted by OpenAlex's citation count. The top five are kept per year, and the top three
in each of OpenAlex's four domains for the field filter.

Then the records that are not a year's real paper are dropped (`build.py` has the list
and the reasons):

- **Reprints** are dated by their reprint, so a title already shown in an earlier year is
  dropped from later ones (Arrow's *Learning by Doing* of 1962, again under 1971).
- **Re-dated classics** with no earlier record to match, excluded by id: Festinger's 1957
  *Cognitive Dissonance* filed under 2017, Hotelling's 1929 *Stability in Competition*
  under 1990, and three more.
- **Book reviews** ("The American Voter. By A. Campbell, …") and one-line corrections.

## What it cannot tell you

Citation counts are OpenAlex's, not Google Scholar's, and old papers have had longer to
gather them, so compare a year with its neighbours. Affiliation is as OpenAlex resolves
it, which for early papers can be wrong in either direction. OpenAlex returns at most
100 authors per work, so a large consortium's Stanford authors may be past the list.

Not affiliated with Stanford University. Built by Claude.
