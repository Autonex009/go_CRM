package httpx

// IsUUID reports whether s has the shape of a UUID.
//
// A shape check, not a parse: every caller uses it to reject a filter before it
// reaches SQL that would cast it, where a malformed value surfaces as a 500
// rather than the 400 it actually is. Three modules had byte-identical copies
// of this before it moved here.
func IsUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, c := range s {
		switch i {
		case 8, 13, 18, 23:
			if c != '-' {
				return false
			}
		default:
			isHex := (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
			if !isHex {
				return false
			}
		}
	}
	return true
}
