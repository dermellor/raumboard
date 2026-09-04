-- One room may serve several classes: scope stays 'all' or becomes a JSON
-- array of klassIds (see src/types.ts). Existing single-class scopes turn
-- into one-element arrays; 'all' is untouched.
UPDATE rooms SET scope = json_array(scope) WHERE scope != 'all';
