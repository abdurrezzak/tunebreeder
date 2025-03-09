# tunebreeder

1- When the system starts there are E different evolutions start. 
2- in each evolution E_i, there are n randomly initialiazed genomes. 
3- Let's say there are x users. 
4- When a user clicks contribute on the main page, the system automatically gives one of the current possible genomes out of all current genomes (a genome of experiment_i randomly at the current generation).
5- When all of the genomes of a given generation in an experiment E_i is mutated and scored by the users, the backend applies evolutionary algorithm (cross-over between top genomes. )
6- new generations genomes are saved to current genomes for Experiment_i
7- If an experiment reaches 1000 iterations, the final highest scored genome is saved as Anonymous art-piece. 
