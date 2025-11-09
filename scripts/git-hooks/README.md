This folder contains git hook scripts used by local developers.

To install hooks locally:

chmod +x scripts/git-hooks/pre-commit scripts/git-hooks/pre-push
ln -sf ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit
ln -sf ../../scripts/git-hooks/pre-push .git/hooks/pre-push

If using a tool like `lefthook` or `husky`, configure accordingly.
