<?php

mysql_connect("localhost", "jczaplewski", "pbdb") or die(mysql_error());
mysql_select_db("pbdb") or die(mysql_error());

$search = $_GET['query'];

$query = "SELECT taxon_name AS name, taxon_rank AS rank FROM taxon_search WHERE taxon_name LIKE '" . $search . "%' AND is_exact = 1 AND genus = '' ORDER BY FIELD(taxon_rank, 'kingdom', 'subkingdon', 'superphylum', 'phylum', 'subphylum', 'superclass', 'class', 'subclass', 'infraclass', 'superorder', 'order', 'suborder', 'infraorder', 'superfamily', 'family', 'subfamily', 'tribe', 'subtribe', 'genus', 'subgenus', 'species', 'subspecies', 'unranked clade', 'informal') LIMIT 10";

$result = mysql_query($query)
or die(mysql_error());

$data = array();

while ($row = mysql_fetch_array($result, MYSQL_ASSOC)) {
	$data[]=$row;
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode($data);

?>