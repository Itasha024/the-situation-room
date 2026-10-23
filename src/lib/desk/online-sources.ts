/**
 * The Online watch's channels (user, 23 Oct: "reflect the general conversation in Gaza and in Judea and
 * Samaria at all times"): the desk's Palestinian channels and the public channels where people in each town
 * and camp talk, found and checked on 23 Oct (each showed posts of that day on its public page). Groups
 * (no public page) need a signed-in Telegram account and are not here yet.
 */
import { GAZA_TG } from "./gaza-sources.ts";

export type WatchArea = "gaza" | "js" | "both";
export type WatchChannel = { id: string; area: WatchArea };

const GAZA = "madinat_khanyuns khnmedia asmailpress hanialshaer azzammedia0 nailkhn mostamron mohnadQ rafahbordernews rafahaonlain Derbalh yafahospital alburaij burijofficial megazipress mohammedalbehairy shamal_online1 saedalzaneen8 RasadAlmedan NewsPs0 mumenjmmeqdad azzamaddas alhodhud gaza_martyrs musaeadatgaza wwwwnnnw mostfidon asarsook aluolaa GAZA20249 qeratan Gaza_shaheed mawagaza mtqdmon jobspals2 Gazarecruiters Gaza_families Et3alimm iugaza1 almon5ol yousefhassan11 ghfhf11 Fe_khalal gazaalannet shaabvoice News_now1 mehwaralmokawma httpshgfhskskdkd akhbar3alreeq gazalivee Barqgaza sa7atPl mejhar alkhamisapal sndnewsa gazala7zapal1 qag_2 Qsam_new qassamiah7alat MoqawamaVoice ahyaasq";
const JS = "Jeninal3mliaat rueib_alkian Qabatyia sanuorbldna bir_al_bash aldeeerrrjenin nashit_jenin nabuls_news rassd Nablispost balata_alhadat Balata12 dooz_palestine a7rartullkarm samsalmohaiam alrasdalkarmi77 sarayatulkarm SrayaTolkrm A7rartoubas tubasalkdraa Faracamp aqappaA7rar ahrar_qalqilia qalqilya_alhadath bawabatqalqilia qalfirst selfetnews radioalzaytona ramallahmix1 ramallahnew birzeitpress1 sawtalmughayyir koformalik12 amen24fm anajahuni bethlahem_alhadath bethlehemnewss ahrarsurif khalelnews DuraCity jerichocm jerichomix2022";
const BOTH = "palnws24 Palsawacom PalTodayps alwatanvoice paltimenet PalpostN fatehpress daffamedia qudsnmedia soundps beawareps sardps1 newpress1 alersalps meshheek yaseenizz asranews1 ppsmo AlQastalps RayaNewsPS salamtv1 hawanatv alqudstodaytv shms_news paldf_net AJPalestine";

/** The desk's own Palestinian channels that tell one area. */
const OWN_AREA: Record<string, WatchArea> = {
  jenencamb: "js", jeninnews1: "js", jeninnews: "js", TubasTimes: "js", TulkaremNet: "js", noursams: "js", nablusnews: "js",
  Nuseirat1: "gaza", AlShatiNews: "gaza", msdrnews: "gaza", hamza20300: "gaza", osama1984osama: "gaza", anas1020304050: "gaza", JusorNews: "gaza",
  safypress90: "gaza", muthanapress84: "gaza", mediagovps: "gaza", MOHMediaGaza: "gaza", moigovps: "gaza", dcdgaza: "gaza", palmoh: "js",
};

const list = (s: string, area: WatchArea) => s.split(/\s+/).filter(Boolean).map((id) => ({ id, area }));
const own = GAZA_TG.filter((s) => s.lean === "pa" || s.lean === "factions" || s.lean === "palestinian").map((s) => ({ id: s.id, area: OWN_AREA[s.id] ?? ("both" as WatchArea) }));

/** Every channel once (Telegram ignores case). */
export const WATCH_TG: WatchChannel[] = [...own, ...list(GAZA, "gaza"), ...list(JS, "js"), ...list(BOTH, "both")].filter(
  (c, i, all) => all.findIndex((o) => o.id.toLowerCase() === c.id.toLowerCase()) === i,
);
