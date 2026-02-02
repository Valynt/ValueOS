#!/usr/bin/env perl
use strict;
use warnings;
for my $file (@ARGV) {
    open my $fh, '<', $file or die "unable to open $file: $!";
    local $/ = undef;
    my $text = <$fh>;
    close $fh;
    my $has_trailing_newline = ($text =~ /\n\z/);
    my @lines = split(/\n/, $text, -1);
    my @out;
    for (my $i = 0; $i <= $#lines; $i++) {
        my $line = $lines[$i];
        if ($line =~ /^\s*CREATE\s+TRIGGER\s+([A-Za-z0-9_]+)/i) {
            my $trg = $1;
            my $table = '';
            for (my $j = $i; $j <= $i+6 && $j <= $#lines; $j++) {
                if ($lines[$j] =~ /\bON\s+([A-Za-z0-9_\.\"]+)/i) {
                    $table = $1;
                    $table =~ s/[\",;]$//;
                    last;
                }
            }
            my $found = 0;
            my $start = $i - 6; $start = 0 if $start < 0;
            for (my $k = $start; $k < $i; $k++) {
                if ($lines[$k] =~ /\bDROP\s+TRIGGER\s+IF\s+EXISTS\b.*\b\Q$trg\E\b/i) { $found = 1; last }
                if ($table ne '' && $lines[$k] =~ /\bDROP\s+TRIGGER\s+IF\s+EXISTS\b.*\bON\b.*\b\Q$table\E\b/i) { $found = 1; last }
            }
            if (!$found && $table ne '') {
                push @out, "DROP TRIGGER IF EXISTS $trg ON $table;";
            }
        }
        push @out, $line;
    }
    my $out_text = join("\n", @out);
    $out_text .= "\n" if $has_trailing_newline;
    open my $outf, '>', $file or die "unable to write $file: $!";
    print $outf $out_text;
    close $outf;
}
