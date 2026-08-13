# ClinicBuddy

![ClinicBuddy logo](packages/app/static/img/clinical-buddy-logo.svg)

ClinicBuddy is a secure clinical workspace for healthcare teams. It brings patient records, orders, forms,
diagnostic workflows, scheduling, and operational tools into one FHIR-native application.

The product is built on the open-source Medplum platform. The repository keeps the upstream `@medplum/*` package names
and FHIR contracts for compatibility while applying the ClinicBuddy identity at the application layer.

- **Clinical workspace** - Search, review, and edit standards-based patient and clinical data.
- **Identity and access** - OAuth, OpenID, SMART-on-FHIR, project memberships, and access policies.
- **Clinical automation** - Bots, questionnaires, subscriptions, and workflow tooling.
- **Interoperability** - FHIR APIs plus HL7, DICOM, and integration packages.
- **Reusable UI** - React components and hooks for extending ClinicBuddy safely.

## Docs

- [Contributing](#contributing)
  - [Ground Rules](#ground-rules)
  - [Codebase](#codebase)
    - [Technologies](#technologies)
    - [Folder Structure](#folder-structure)

## Contributing

**We heartily welcome any and all contributions that match our engineering standards!**

That being said, this codebase isn't your typical open-source project because it's not a library or package with a
limited scope -- it's our entire product. Our [Contributing documentation](https://medplum.com/docs/contributing) has
all the information you need to get started.

### Ground Rules

#### Contributions and discussion guidelines

By making a contribution to this project, you are deemed to have accepted the [Developer Certificate of Origin](https://developercertificate.org/) (DCO).

All conversations and communities on Medplum are expected to follow GitHub's [Community Guidelines](https://help.github.com/en/github/site-policy/github-community-guidelines)
and [Acceptable Use Policies](https://help.github.com/en/github/site-policy/github-acceptable-use-policies). We expect
discussions on issues and pull requests to stay positive, productive, and respectful. Remember: there are real people on
the other side of the screen!

#### Reporting a bug or proposing a new feature

If you found a technical bug on Medplum or have ideas for features we should implement, the issue tracker is the best
place to share with us. ([click here to open a new issue](https://github.com/medplum/medplum/issues/new))

### Writing documentation or blog content

Did you learn how to do something using Medplum that wasn't obvious on your first try? By contributing your new knowledge
to our documentation, you can help others who might have a similar use case!

Our documentation is hosted on [medplum.com/docs](https://www.medplum.com/docs), but it is built from [Markdown](https://www.markdownguide.org/)
files in our [`docs` package](https://github.com/medplum/medplum/tree/main/packages/docs/docs).

For relatively small changes, you can edit files directly from your web browser on [GitHub.dev](https://github.dev/medplum/medplum/blob/main/packages/docs/docs/home.md)
without needing to clone the repository.

#### Fixing a bug or implementing a new feature

If you find a bug and open a Pull Request that fixes it, we'll review it as soon as possible to ensure it meets our engineering standards.

If you want to implement a new feature, open an issue first to discuss with us how the feature might work, and to ensure
it fits into our roadmap and plans for the app.

If you want to contribute but are unsure how to start, we have [a "good first issue" label](https://github.com/medplum/medplum/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) which is applied to newcomer-friendly issues. Take a look at [the full list of good first issues](https://github.com/medplum/medplum/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) and pick something you like!

**Ready to get started writing code?** Follow the [local setup instructions](https://www.medplum.com/docs/contributing/local-dev-setup) and jump in!

### Codebase

#### Technologies

With the ground rules out of the way, let's talk about the coarse architecture of this mono repo:

- **Full-stack TypeScript**: We use Node.js to power our servers, and React to power our frontend apps. Almost all of the code you'll touch in this codebase will be TypeScript.

Here is a list of all the big technologies we use:

- **PostgreSQL**: Data storage
- **Redis**: Background jobs and caching
- **Express**: API server
- **TypeScript**: Type-safe JavaScript
- **React**: Frontend React app

#### Folder structure

```sh
clinic-buddy/
├── packages
│   ├── agent           # On-premise agent
│   ├── app             # Frontend web app
│   ├── bot-layer       # AWS Lambda Layer for Bots
│   ├── cdk             # AWS CDK infra as code
│   ├── cli             # Command line interface
│   ├── core            # Core shared library
│   ├── definitions     # Data definitions
│   ├── docs            # Documentation
│   ├── examples        # Example code used in documentation
│   ├── fhir-router     # FHIR URL router
│   ├── fhirtypes       # FHIR TypeScript definitions
│   ├── generator       # Code generator utilities
│   ├── graphiql        # Preconfigured GraphiQL
│   ├── hl7             # HL7 client and server
│   ├── mock            # Mock FHIR data for testing
│   ├── react           # React component library
│   ├── react-hooks     # React hooks library
│   └── server          # Backend API server
└── scripts             # Helper bash scripts
```

## Thanks

<a href="https://www.chromatic.com/"><img src="https://user-images.githubusercontent.com/321738/84662277-e3db4f80-af1b-11ea-88f5-91d67a5e59f6.png" width="153" height="30" alt="Chromatic" /></a>

Thanks to [Chromatic](https://www.chromatic.com/) for providing the visual testing platform that helps us review UI changes and catch visual regressions.

## License

[Apache 2.0](LICENSE.txt)
